import open3d as o3d 
from backend.bbox_annotations.annotation import LocalAnnotation 
from backend.sensor_interface.core.pointcloud import load_single_scan

import numpy as np 
import json 
import yaml
import os


lidar = "rslidar"

annotations_path = f"/media/ai/T7/agco_test_set/agco2026/static_2/split_2/{lidar}/annotations/"
coord_path = f"/media/ai/T7/agco_test_set/agco2026/static_2/split_2/{lidar}/pointcloud_raw/coord/"
dataset_root = "/media/ai/T7/agco_test_set/agco2026/static_2/split_2/"





print(len(os.listdir(annotations_path)))
print(len(os.listdir(coord_path)))

with open("backend/sensor_interface/visualization/calibration/march_12_calibration.yaml", 'r') as calib: 
    calibration = yaml.load(calib, yaml.SafeLoader)

T_rtk = np.array(calibration["T_rtk_sensors"][lidar]["matrix"])

print(T_rtk)

for annotation_json in sorted(os.listdir(annotations_path)):
    local_annotations = []
    
    local_annotations_o3d = []

    with open(os.path.join(annotations_path, annotation_json), 'r') as annot:
        annotations = json.load(annot)


    for annotation_asset_json in annotations["annotations"]:
        local_annot = LocalAnnotation()
        local_annot.from_local_dict(annotation_asset_json)
        if local_annot.inliers > 0: 
            print("active boundingbox found")
        local_annotations.append(local_annot)
        local_annotations_o3d.append(local_annot.asset)


    scan = load_single_scan(dataset_root,lidar,fname=annotation_json.replace("json","npy"))
    
    
    pcd = o3d.geometry.PointCloud(o3d.utility.Vector3dVector(scan.to_rtk(T_rtk))) 

    
    o3d.visualization.draw_geometries(local_annotations_o3d + [pcd, o3d.geometry.TriangleMesh.create_coordinate_frame()])






