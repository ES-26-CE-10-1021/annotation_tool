import json 
import pathlib 

import numpy as np 
import open3d as o3d 
from backend.sensor_interface.core import Dataset, pointcloud
from backend.bbox_annotations.annotation import GlobalAnnotation 
from typing import List
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
        max_lat_std=0.02,
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

                
        local_annot_assets = [] 
        
        
        for global_annot in prop.functional_annotations:
            global_annot: GlobalAnnotation = global_annot 
            local_annot_assets.append(global_annot.get_local_annotation(pcd, np.linalg.inv(T_world)))
        
        sequence_local_annotations.append(local_annot_assets)

        
    print("global annotations propagated to point clouds")







 




