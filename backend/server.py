from flask import Flask, Response, send_from_directory, jsonify, request
import numpy as np
import open3d as o3d 
from pathlib import Path

from flask_compress import Compress

from backend.loaders.dataset_loader import lidar_loader
import argparse
import yaml
import json




def main(args):
    with open(args.config, 'r') as f:
        config = yaml.load(f, Loader=yaml.FullLoader)
    
    chunk_size = config['server']['chunk_size']


    # load dataset
    state = {
        "dataset": None,
        "points": None,
        "normals": None,
        "annotation_path": None
    }
    
    # dataset_dir = config['server']['data_file_path']
    
    global_voxel_size = config['server']['global_point_cloud_voxel_dowsampling']
    local_voxel_size = config['server']['local_point_cloud_voxel_downsampling']
    point_cloud_sampling_stride = config['server']['point_cloud_sampling_stride']
   

    def load_dataset(dataset_path):

        ds = lidar_loader(
            dataset_path,
            global_voxel_size,
            local_voxel_size,
            point_cloud_sampling_stride
        )

        points = np.array(ds.point.positions.numpy(), dtype=np.float16)
        normals = np.array(ds.point.normals.numpy(), dtype=np.float16)

        annotation_path = dataset_path / config['server']['annotation_file']

        return ds, points, normals, annotation_path


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
            d.name for d in base.iterdir() if d.is_dir()
        ])




    @app.route("/api/select", methods=["POST"])
    def select():

        data = request.get_json()

        dataset_path = (
            Path(config['server']['data_root']) /
            data["dataset"] /
            data["sequence"] /
            data["lidar"]
        )

        ds, pts, nrm, ann = load_dataset(dataset_path)

        state["dataset"] = ds
        state["points"] = pts
        state["normals"] = nrm
        state["annotation_path"] = ann

        print(f"Loaded dataset: {dataset_path}")
        print(f"Points: {pts.shape}")

        return jsonify({"status": "ok"})



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
            return jsonify({"version": 1, "bboxes": []})

        if not state["annotation_path"].exists():
            return jsonify({"version": 1, "bboxes": []})

        with open(state["annotation_path"], "r") as f:
            data = json.load(f)

        return jsonify(data)


    @app.route("/api/bboxes", methods=["POST"])
    def save_bboxes():

        if state["annotation_path"] is None:
            return jsonify({"error": "No dataset selected"}), 400

        data = request.get_json()

        if not data or "bboxes" not in data:
            return jsonify({"error": "Invalid format"}), 400

        with open(state["annotation_path"], "w") as f:
            json.dump(data, f, indent=2)

        return jsonify({"status": "ok"})

    app.run(debug=True) 



if __name__ == "__main__":
    argument_parser = argparse.ArgumentParser()
    argument_parser.add_argument("config", help="file path to the config file", type=str)

    args = argument_parser.parse_args()
    

    main(args)
