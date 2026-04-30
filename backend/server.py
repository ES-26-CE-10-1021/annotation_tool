from flask import Flask, Response, send_from_directory, jsonify, request
import numpy as np
import open3d as o3d 
from pathlib import Path

from flask_compress import Compress

from backend.loaders.agco_loader import lidar_loader
import argparse
import yaml
import json
from scipy.spatial.transform import Rotation as Rot

from backend.sensor_interface.core.dataset import Dataset
from backend.propagators.agco_propagator import Propagator

from collections import OrderedDict 


def main(args):
    with open(args.config, 'r') as f:
        config = yaml.load(f, Loader=yaml.FullLoader)
    
    chunk_size = config['server']['chunk_size']


    # load dataset
    state = {
        "dataset": None,
        "points": None,
        "normals": None,
        "annotation_path": None,
        "R_level": None,
        "lidar":None
    }

    def _transform_tree(nodes, R):
        out = []
        for n in nodes:
            m = dict(n)
            m["position"] = R.apply(np.asarray(n["position"], dtype=np.float64)).tolist()
            q_in = Rot.from_quat(n["rotationQuaternion"])
            m["rotationQuaternion"] = (R * q_in).as_quat().tolist()
            m["children"] = _transform_tree(n.get("children", []), R)
            out.append(m)
        return out
    
    # dataset_dir = config['server']['data_file_path']
    
    global_voxel_size = config['server']['global_point_cloud_voxel_dowsampling']
    local_voxel_size = config['server']['local_point_cloud_voxel_downsampling']
    point_cloud_sampling_stride = config['server']['point_cloud_sampling_stride']
    coord_dir = config['server']['coord_dir_name']
    lidar_types = config['server']['lidar_types']
    max_cache_size = config['server']['max_cache_size']
    max_azimuth_std = config['server']['max_azimuth_std']
    calibration_file = config['server']['calibration_file']

    local_pointcloud_cache = OrderedDict()
    
    full_dataset = None

    def load_dataset(dataset_path, lidar):

        ds, R_level = lidar_loader(
            dataset_path,
            lidar,
            global_voxel_size,
            local_voxel_size,
            point_cloud_sampling_stride
        )

        points = np.array(ds.point.positions.numpy(), dtype=np.float16)
        normals = np.array(ds.point.normals.numpy(), dtype=np.float16)

        annotation_path = dataset_path / config['server']['annotation_file']

        return ds, points, normals, annotation_path, R_level


    app = Flask(
        __name__,
        static_folder=Path("../frontend/"),
        static_url_path="" 
    )
    Compress(app)

    @app.route("/")
    def index():
        return send_from_directory(app.static_folder, "index.html")
    
    @app.route("/api/config")
    def get_config():
        print(jsonify(config))
        return jsonify(config)

    @app.route("/api/datasets")
    def list_datasets():
        base = Path(config['server']['data_root'])

        return jsonify([
            d.name for d in base.iterdir() if d.is_dir()
        ])
    @app.route("/api/sequences/<dataset>")
    def list_sequences(dataset):

        base = Path(config['server']['data_root']) / dataset

        return jsonify([
            d.name for d in base.iterdir() if d.is_dir()
        ])

    @app.route("/api/lidars/<dataset>/<sequence>")
    def list_lidars(dataset, sequence):

        base = Path(config['server']['data_root']) / dataset / sequence

        return jsonify([
            d.name for d in base.iterdir() if (d.is_dir() and d.name in lidar_types)
        ])




    @app.route("/api/select", methods=["POST"])
    def select():

        data = request.get_json()

        dataset_path = (
            Path(config['server']['data_root']) /
            data["dataset"] /
            data["sequence"]
        )
        

        ds, pts, nrm, ann, R_level = load_dataset(dataset_path, lidar = data["lidar"])

        
        full_dataset = Dataset(
            data_dir=dataset_path,
            sensor_config="backend/sensor_interface/visualization/calibration/march_12_calibration.yaml",
            max_azimuth_std=config["server"]["max_azimuth_std"]
        )
        print("full dataset loaded")
        
        state["full_dataset"] = full_dataset
        state["dataset_path"] = dataset_path
        state["lidar"] = data["lidar"]
        state["dataset"] = ds
        state["points"] = pts
        state["normals"] = nrm
        state["annotation_path"] = ann
        state["R_level"] = R_level

        local_pointcloud_cache.clear()

        print(f"Loaded dataset: {dataset_path}")
        print(f"Points: {pts.shape}")

        return jsonify(
            {"status": "ok",
             "num_frames":len(full_dataset),
             "max_index":len(full_dataset) -1}
        )



    @app.route("/api/points/<int:chunk>")
    def stream_points(chunk):

        if state["points"] is None:
            return Response("No dataset selected", status=400)

        points = state["points"]
        normals = state["normals"]

        start = chunk * chunk_size
        end = min(start + chunk_size, len(points))

        if start >= len(points):
            return Response(status=204)

        data = np.hstack([points[start:end], normals[start:end]]).astype(np.float16)

        return Response(data.tobytes(), mimetype="application/octet-stream")


    @app.route("/api/bboxes", methods=["GET"])
    def get_bboxes():

        if state["annotation_path"] is None:
            return jsonify({"version": 1, "annotations": []})

        if not state["annotation_path"].exists():
            return jsonify({"version": 1, "annotations": []})

        with open(state["annotation_path"], "r") as f:
            data = json.load(f)

        # re-level raw-world boxes into display frame
        R_level = state["R_level"]
        if R_level is not None and "annotations" in data:
            data = {**data, "annotations": _transform_tree(data["annotations"], R_level)}

        return jsonify(data)


    @app.route("/api/bboxes", methods=["POST"])
    def save_bboxes():

        if state["annotation_path"] is None:
            return jsonify({"error": "No dataset selected"}), 400

        data = request.get_json()

        if not data or "annotations" not in data:
            return jsonify({"error": "Invalid format"}), 400

        R_level = state["R_level"]
        if R_level is None:
            return jsonify({"error": "No gravity alignment available"}), 400

        snapshot_path = state["annotation_path"].parent / "gravity_align.npz"
        calibration_save_path = state["annotation_path"].parent / "calibration.yml"
        R_mat = R_level.as_matrix()
        if snapshot_path.exists():
            stored = np.load(snapshot_path)["R_level"]
            if not np.allclose(stored, R_mat, atol=1e-6):
                return jsonify({
                    "error": "gravity_align.npz mismatch — PoseProvider has shifted; aborting save"
                }), 409
        else:
            np.savez(snapshot_path, R_level=R_mat)

        # un-level display-frame boxes back to raw world before persisting
        raw = {**data, "annotations": _transform_tree(data["annotations"], R_level.inv())}
        
        raw["label_name_dict"] = config["frontend"]["label_dict"]


        with open(state["annotation_path"], "w") as f:
            json.dump(raw, f, indent=2)
        
        with open(calibration_file, 'r') as f:
            calib_data = yaml.load(f, yaml.SafeLoader)
        
        with open(calibration_save_path, 'w') as f: 
            yaml.dump(calib_data, f, yaml.SafeDumper)
        

        with open(state["annotation_path"], 'r') as annot:
            propagator = Propagator(annot,  dataset=state["full_dataset"])

        propagator.propagate_all(state["lidar"], save_path=state["dataset_path"]) 

        return jsonify({"status": "ok"})


    

    @app.route("/api/local_points/<int:index>")
    def stream_local_pointcloud(index):
        if state["full_dataset"] is None:
            print("dataset is None")
            return jsonify({"error": "No dataset is loaded"}), 400 
        
        sequence_dataset = state["full_dataset"]
        max_index = len(sequence_dataset) -1 

        if index > max_index: 
            print(f"requested index of {index} is greater than {max_index}")
            return jsonify({"error":"index greater than dataset"}), 400 

        if index < 0: 
            print(f"requested index {index} is negative")
            return jsonify({"error":"negative index"}), 400 

        
        key = (index, state["lidar"])
        print(f"getting frame {key}")

        
        if key in local_pointcloud_cache:
            local_pointcloud_cache.move_to_end(key)
            local_points = local_pointcloud_cache[key]

        else:
            local_frame = sequence_dataset[index] 
            
            local_scan = local_frame.lidar(state["lidar"]) 

            local_points = local_scan.to_rtk().astype(np.float16)
            local_pointcloud_cache[key] = local_points

            if len(local_pointcloud_cache) > max_cache_size:
                local_pointcloud_cache.popitem(last=False)

        return Response(local_points.tobytes(), mimetype="application/octet-stream")

    @app.route("/api/local_bboxes/<int:index>", methods=["GET"])
    def get_local_bboxes(index):
        if state["full_dataset"] is None:
            return jsonify({"annotations": []})

        frame = state["full_dataset"][index]
        scan = frame.lidar(state["lidar"])

        folder = state["dataset_path"] / state["lidar"] / "annotations"
        filename = folder / scan.filename.replace("npy", "json")

        if not filename.exists():
            return jsonify({"annotations": []})

        with open(filename, "r") as f:
            data = json.load(f)

        return jsonify(data)


    app.run(debug=True) 



if __name__ == "__main__":
    argument_parser = argparse.ArgumentParser()
    argument_parser.add_argument("config", help="file path to the config file", type=str)

    args = argument_parser.parse_args()
    

    main(args)
