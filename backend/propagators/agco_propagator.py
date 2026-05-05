import json 
import pathlib 

from cv2 import undistort
import numpy as np 
import open3d as o3d
from tqdm import tqdm 
from backend.sensor_interface.core import Dataset, pointcloud
from backend.bbox_annotations.annotation import GlobalAnnotation 
from typing import List
import os


device = o3d.core.Device("CPU:0")
dtype = o3d.core.float32

def apply_segmentation_filter(inliers, points, normals, annot, config):
    if not config["segmentation"]["use_normal_filter"]:
        return inliers

    return segment_normal_filter(
        points,
        normals,
        inliers,
        annot,
        config["segmentation"]["normal_threshold"],
        config["segmentation"]["height_threshold"]
    )


def get_world_normals(cache_path, world_points):
    if os.path.exists(cache_path):
        normals = np.load(cache_path)
        if len(normals) == len(world_points):
            return normals
     
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
    pcd = o3d.t.geometry.PointCloud()
    pcd.point.positions = o3d.core.Tensor(world_points, dtype, device)
    pcd.estimate_normals()

    normals = np.array(pcd.point.normals.numpy(), dtype=np.float16)
    np.save(cache_path, normals)
    return normals 





    
# def segment_normal_filter(
#     world_points,
#     world_normals,
#     inliers,
#     global_annotation,
#     normal_threshold=0.8,
#     height_threshold=0.2
# ):
#     inliers = np.asarray(inliers, dtype=np.int32)
#
#     pts = world_points[inliers]
#     normals = world_normals[inliers]
#
#     obb = global_annotation.asset
#     center = obb.center
#     R = obb.R
#
#     # --- transform points into bbox local frame ---
#     pts_local = (pts - center) @ R
#
#     bbox_height = global_annotation.dimensions[2] * global_annotation.base_size
#
#     # local z = vertical axis of box
#     height = pts_local[:, 2] + bbox_height * 0.5
#     bottom_mask = height < height_threshold
#
#     # --- normal filtering (still world-aligned) ---
#     z_alignment = np.abs(normals @ np.array([0, 0, 1]))
#     ground_mask = z_alignment > normal_threshold
#
#     remove_mask = bottom_mask & ground_mask
#     keep_mask = ~remove_mask
#
#     pcd = o3d.geometry.PointCloud()
#     pcd.points = o3d.utility.Vector3dVector(world_points)
#
#     o3d.visualization.draw_geometries([pcd, global_annotation.asset])
#
#
#     return inliers[keep_mask]
#


def segment_normal_filter(
    local_points,
    world_normals,
    inliers,
    local_annotation,
    normal_threshold=0.8,
    height_threshold=0.2
):
    inliers = np.asarray(inliers, dtype=np.int32)

    pts = local_points[inliers]
    normals = world_normals[inliers]  # still world-aligned → correct

    obb = local_annotation.asset
    center = obb.center
    R = obb.R

    # transform points into bbox-local frame
    pts_local = (pts - center) @ R

    bbox_height = local_annotation.dimensions[2]

    # height relative to bottom of box
    height = pts_local[:, 2] + bbox_height * 0.5
    bottom_mask = height < height_threshold

    # world-aligned ground detection
    z_alignment = np.abs(normals @ np.array([0, 0, 1]))
    ground_mask = z_alignment > normal_threshold

    remove_mask = bottom_mask & ground_mask

    #
    # colors = np.zeros((len(local_points), 3))
    #
    # colors[inliers] = [1, 0, 0]            # original
    # colors[inliers[~remove_mask]] = [0, 1, 0]   # kept
    #
    # pcd_debug = o3d.geometry.PointCloud()
    # pcd_debug.points = o3d.utility.Vector3dVector(local_points)
    # pcd_debug.colors = o3d.utility.Vector3dVector(colors)
    #
    # o3d.visualization.draw_geometries([
    #     pcd_debug,
    #     local_annotation.asset
    # ])

    return inliers[~remove_mask]

class Propagator: 
    def __init__(self, global_annotations, dataset = None): 
        self.global_annotations_raw = global_annotations 
        self.global_annotations = json.load(global_annotations) 
        self.functional_annotations = []
        
        self.dataset = dataset


        def load_annotations(annotation_json, parent=None): 
            annotation = GlobalAnnotation(annotation_json,parent)

            for child in annotation_json["children"]: 
                annotation.children.append(load_annotations(child, annotation))
            
            return annotation 

        for annotation in self.global_annotations["annotations"]: 
            self.functional_annotations.append(load_annotations(annotation))
    
    def get_local_annotations(self, pcd, world_frame):
        local_annot_assets = [] 
        
        def get_local_annotation(global_annotation: GlobalAnnotation, pcd, world_frame, parent_local=None):
            local_annotation = global_annotation.get_local_annotation(pcd, world_frame)
            for global_child in global_annotation.children: 
                local_annotation.children.append(get_local_annotation(global_child, pcd, world_frame, local_annotation))
                local_annotation.parent = parent_local 
             
        for global_annotation in self.functional_annotations:
            local_annot_assets.append(get_local_annotation(global_annotation, pcd, world_frame))

        return local_annot_assets 

    def annotation_flat_list(self) -> List[GlobalAnnotation]:  
        flat_list = []
        def annot_loader(annot_list, depth = 0): 
            for annot in annot_list: 
                print(annot.type, depth)
                flat_list.append(annot)
                annot_loader(annot.children, depth=depth + 1)
        
        annot_loader(self.functional_annotations)

        return flat_list

    def propagate_all(self, lidar, save_path, config):
        for i in tqdm(range(len(self.dataset))): 
            frame = self.dataset[i]
            T_world = frame.T_world_body
            pos, quat = frame.pose
            scan = frame.lidar(lidar)
            frame.timestamp 
            pcd = o3d.geometry.PointCloud(o3d.utility.Vector3dVector(scan.to_rtk())) 
            
            world_points = scan.to_world(undistort=True, gravity_align = True)
            world_normals = get_world_normals(os.path.join(save_path,lidar,"world_normals",scan.filename), world_points)

            local_annot_assets = [] 
            
            local_annotation_dict = {}
            local_annotation_dict["annotations"] = []
            local_annotation_dict["timestamp"] = frame.timestamp  
            
            segment = np.zeros(len(pcd.points))
            instance = np.zeros(len(pcd.points))

            for global_annot in self.functional_annotations:
                global_annot: GlobalAnnotation = global_annot 
                
                local_annotation = global_annot.get_local_annotation(pcd, T_world)
                
                # segment[local_annotation.inlier_list] = local_annotation.label 
                
                inliers = np.asarray(local_annotation.inlier_list)

                local_points = np.asarray(pcd.points)
                
                assert len(world_normals) == len(local_points) 
                filtered_inliers = apply_segmentation_filter(
                    inliers,
                    local_points,
                    world_normals,
                    local_annotation,
                    config
                )

                # segment[inliers] = 0
                segment[filtered_inliers] = local_annotation.label

                # instance[inliers] = 0
                instance[filtered_inliers] = global_annot.instance

                local_annot_assets.append(local_annotation)
        
                local_annotation_dict["annotations"].append(local_annotation.to_dict()) 
            



            folder = os.path.join(save_path, lidar, "annotations")
            os.makedirs(folder, exist_ok=True)

            filename = os.path.join(
                folder,
                scan.filename.replace("npy", "json")
            )


            with open(filename, "w") as f:
                json.dump(local_annotation_dict, f, indent=4)

            transform_dir = os.path.join(save_path, lidar, "global_transforms")
            os.makedirs(transform_dir, exist_ok=True)
            np.save(os.path.join(transform_dir, scan.filename), T_world)


            if config['server']['save_segment']: 
                segment_dir = os.path.join(save_path, lidar, "segment")
                os.makedirs(segment_dir, exist_ok=True)
                np.save(os.path.join(segment_dir, scan.filename), segment.astype(np.uint16))

                instance_dir = os.path.join(save_path, lidar, "instance")
                os.makedirs(instance_dir, exist_ok=True)
                np.save(os.path.join(instance_dir, scan.filename), instance.astype(np.uint16))


if __name__ == "__main__": 
    test_annotations_fp = "/media/ai/T7/agco_test_set/agco2026/static_2/split_2/bboxes.json"
    
    with open(test_annotations_fp, 'r') as annot:
        prop = Propagator(annot)
    
    dataset_split = "/media/ai/T7/agco_test_set/agco2026/static_2/split_2/"
    
    from backend.loaders.agco_loader import lidar_loader 
    
    lidar = "rslidar"

    pointcloud, _R_level = lidar_loader(dataset_split, lidar, global_voxel_size=0.7, local_voxel_size=0.5, stride=1)

    annotation_assets = []

    for annotation in prop.annotation_flat_list(): 
        annotation_assets.append(annotation.asset)

    o3d.visualization.draw_geometries(annotation_assets + [pointcloud.to_legacy()])


    ds = Dataset(
        data_dir=dataset_split,
        sensor_config="backend/sensor_interface/visualization/calibration/march_12_calibration.yaml",
    )
    
    
    sequence_local_annotations = []


    for i in range(len(ds)): 
        frame = ds[i]
        print(f"got frame {frame}")

        T_world = frame.T_world_body
        pos, quat = frame.pose

        print(f"frame transforms, world{T_world}, pos{pos}, quat{quat}")



        scan = frame.lidar(lidar)


        pcd = o3d.geometry.PointCloud(o3d.utility.Vector3dVector(scan.to_rtk())) 

        local_points = np.asarray(pcd.points)

        world_points = scan.to_world(undistort=True, gravity_align=True)
        world_normals = get_world_normals(
            os.path.join("/tmp", "normals.npy"),  # temp path is fine for debug
            world_points
        )

        for global_annot in prop.functional_annotations:
            local_annotation = global_annot.get_local_annotation(pcd, np.linalg.inv(T_world))

            inliers = np.asarray(local_annotation.inlier_list, dtype=np.int32)

            if len(inliers) == 0:
                continue

            filtered_inliers = segment_normal_filter(
                local_points,
                world_normals,
                inliers,
                local_annotation
            )

            # ---------------------------
            # DEBUG VISUALIZATION
            # ---------------------------
            colors = np.zeros((len(local_points), 3))

            colors[inliers] = [1, 0, 0]              # red = original
            colors[filtered_inliers] = [0, 1, 0]     # green = kept

            pcd_debug = o3d.geometry.PointCloud()
            pcd_debug.points = o3d.utility.Vector3dVector(local_points)
            pcd_debug.colors = o3d.utility.Vector3dVector(colors)

            print(f"inliers: {len(inliers)} → filtered: {len(filtered_inliers)}")

            o3d.visualization.draw_geometries([
                pcd_debug,
                local_annotation.asset,
                o3d.geometry.TriangleMesh.create_coordinate_frame()
            ])
    
    print("global annotations propagated to point clouds")







 




