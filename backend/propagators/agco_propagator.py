import json 
import pathlib 

import numpy as np 
import open3d as o3d
from tqdm import tqdm 
from backend.sensor_interface.core import Dataset, pointcloud
from backend.bbox_annotations.annotation import GlobalAnnotation 
from typing import List
import os 
# class Annotation: 
#     def __init__(self, json_annot ,parent=None): 
#         self.type = json_annot["type"] 
#         self.children = [] 
#         self.parent = parent 
#         self.label = json_annot["label"]
#         self.note = json_annot["note"]
#     





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

    def propagate_all(self, lidar, save_path):
        for i in tqdm(range(len(self.dataset))): 
            frame = self.dataset[i]
            T_world = frame.T_world_body
            pos, quat = frame.pose
            scan = frame.lidar(lidar)
            frame.timestamp 
            pcd = o3d.geometry.PointCloud(o3d.utility.Vector3dVector(scan.to_rtk())) 

                    
            local_annot_assets = [] 
            
            local_annotation_dict = {}
            local_annotation_dict["annotations"] = []
            local_annotation_dict["timestamp"] = frame.timestamp  
            
            for global_annot in self.functional_annotations:
                global_annot: GlobalAnnotation = global_annot 
                
                local_annotation = global_annot.get_local_annotation(pcd, np.linalg.inv(T_world))
                local_annot_assets.append(local_annotation)
        
                local_annotation_dict["annotations"].append(local_annotation.to_dict()) 
            



            folder = os.path.join(save_path, lidar, "annotations")
            os.makedirs(folder, exist_ok=True)

            filename = os.path.join(
                folder,
                f"{frame.timestamp}.json"
            )

            with open(filename, "w") as f:
                json.dump(local_annotation_dict, f, indent=4)







if __name__ == "__main__": 
    test_annotations_fp = "/media/ai/T7/agco2026/static_2/split_2/bboxes.json"
    
    with open(test_annotations_fp, 'r') as annot:
        prop = Propagator(annot)
    
    dataset_split = "/media/ai/T7/agco2026/static_2/split_2/"
    
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
        
        o3d.visualization.draw_geometries([pcd, o3d.geometry.TriangleMesh.create_coordinate_frame()])
             
        local_annot_assets = [] 
        
        
        for global_annot in prop.functional_annotations:
            global_annot: GlobalAnnotation = global_annot 
            local_annot_assets.append(global_annot.get_local_annotation(pcd, np.linalg.inv(T_world)))
        
        sequence_local_annotations.append(local_annot_assets)
        
    print("global annotations propagated to point clouds")







 




