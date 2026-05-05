import argparse
import sys
import os

import tqdm


# ── path bootstrap ───────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SCRIPTS_ROOT = os.path.join(SCRIPT_DIR, "..", "..", "..")  # scripts/
sys.path.insert(0, SCRIPTS_ROOT)
from pathlib import Path
from backend.sensor_interface.core import Dataset
import open3d as o3d 
import numpy as np 


device = o3d.core.Device("CPU:0")
dtype = o3d.core.float32

def lidar_loader(dataset_split, lidar, global_voxel_size:float, local_voxel_size:float, stride:int, colors=False):

    print("lidar loader")
    ds = Dataset(
        data_dir=dataset_split,
        sensor_config="backend/sensor_interface/visualization/calibration/march_12_calibration.yaml",
        max_azimuth_std=2.7,
    )

    R_level = ds.pose_provider.world_level_rotation

    positions = []
    normals = []
    pcd_colors_list = []
    for i in tqdm.tqdm(range(len(ds))):
        if i % stride  == 0:
            frame = ds[i]
            print(f"got frame {frame}")

            T_world = frame.T_world_body
            pos, quat = frame.pose

            print(f"frame transforms, world{T_world}, pos{pos}, quat{quat}")

            if colors: 
                pts_world, point_colors = frame.colorize_from_camera(lidar, gravity_allign=True)
                pcd = o3d.t.geometry.PointCloud()
                pcd.point.positions = o3d.core.Tensor(pts_world, dtype, device)
                pcd.point.colors = o3d.core.Tensor(point_colors, dtype, device)
            
            else:
                scan = frame.lidar(lidar)
                print(f"got scan with {scan}")
                pts_world = scan.to_world(undistort=True, gravity_align=True)
                pcd = o3d.t.geometry.PointCloud()
                pcd.point.positions = o3d.core.Tensor(pts_world, dtype, device)
            
            pcd = pcd.voxel_down_sample(voxel_size=local_voxel_size)
            pcd.estimate_normals()
            
            positions.append(pcd.point.positions)
            normals.append(pcd.point.normals)
            if colors:
                pcd_colors_list.append(pcd.point.colors)


    global_pcd = o3d.t.geometry.PointCloud()
    positions = o3d.core.concatenate(positions, axis=0)
    normals = o3d.core.concatenate(normals, axis=0)
    if colors:
        point_colors = o3d.core.concatenate(pcd_colors_list)
        global_pcd.point.colors = point_colors

    global_pcd.point.positions = positions
    global_pcd.point.normals = normals
    global_pcd = global_pcd.voxel_down_sample(voxel_size=global_voxel_size)
     
    o3d.visualization.draw_geometries([global_pcd.to_legacy()])

    return global_pcd, R_level

if __name__ == "__main__":
    lidar_loader("/media/ai/T7/agco2026/static_2/full_split/", "rslidar", 0.05, 0.03, 1, colors=True)
