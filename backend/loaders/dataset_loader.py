import numpy as np
import open3d as o3d 
from tqdm import tqdm
import os


device = o3d.core.Device("CPU:0")
dtype = o3d.core.float32

def lidar_loader(lidar_dir):
    filenames = sorted(os.listdir(os.path.join(lidar_dir, "coord")))
    
    n_annotations = len(filenames)
    initial_tf_set = False
    initial_tf = np.eye(4)
    global_pcd = o3d.t.geometry.PointCloud()
    positions = []
    normals = []
    for i, filename in tqdm(enumerate(filenames), total=n_annotations):
        if i % 2  == 0:
            points = np.load(os.path.join(lidar_dir,"coord",filename)).astype(np.float32)
            segment = np.load(os.path.join(lidar_dir,"segment",filename))
            # bounding_boxes_points = np.load(os.path.join(lidar_dir,"bounding_boxes_points",filename))
            tf = np.load(os.path.join(lidar_dir, "global_transforms", filename))

            pcd = o3d.t.geometry.PointCloud()
            pcd.point.positions = o3d.core.Tensor(points, dtype, device)
            pcd = pcd.voxel_down_sample(voxel_size=0.1)

            pcd.transform(o3d.core.Tensor(tf, dtype, device))
            pcd.estimate_normals()
            
            positions.append(pcd.point.positions)
            normals.append(pcd.point.normals)


    positions = o3d.core.concatenate(positions, axis=0)
    normals = o3d.core.concatenate(normals, axis=0)

    global_pcd = o3d.t.geometry.PointCloud()
    global_pcd.point.positions = positions
    global_pcd.point.normals = normals
    global_pcd = global_pcd.voxel_down_sample(voxel_size=0.03)
    
    # o3d.visualization.draw_geometries([global_pcd])

    return global_pcd
    
        
