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

    
    dataset_dir = config['server']['data_file_path']
    
    global_voxel_size = config['server']['global_point_cloud_voxel_dowsampling']
    local_voxel_size = config['server']['local_point_cloud_voxel_downsampling']
    point_cloud_sampling_stride = config['server']['point_cloud_sampling_stride']
    

    dataset = lidar_loader(dataset_dir, global_voxel_size, local_voxel_size, point_cloud_sampling_stride)

    points = np.array(dataset.point.positions.numpy(), dtype=np.float16)
    normals = np.array(dataset.point.normals.numpy(), dtype=np.float16)

    print(points.shape)
    print(config)
    annotation_path = Path(dataset_dir) / config['server']['annotation_file']

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
        return jsonify(config)


    @app.route("/api/points/<int:chunk>")
    def stream_points(chunk):

        start = chunk * chunk_size
        end = min(start + chunk_size, len(points))

        if start >= len(points):
            return Response(status=204)

        # data = points[start:end]
        #
        # return Response(data.tobytes(), mimetype="application/octet-stream")
        data = np.hstack([points[start:end], normals[start:end]]).astype(np.float16)
        return Response(data.tobytes(), mimetype="application/octet-stream")


    @app.route("/api/bboxes", methods=["GET"])
    def get_bboxes():

        if not annotation_path.exists():
            return jsonify({"version": 1, "bboxes": []})

        with open(annotation_path, "r") as f:
            data = json.load(f)
            print(data)

        return jsonify(data) 

    @app.route("/api/bboxes", methods=["POST"])
    def save_bboxes():

        data = request.get_json()

        if not data or "bboxes" not in data:
            return jsonify({"error": "Invalid format"}), 400

        # Optional: validation (recommended)
        for bbox in data["bboxes"]:
            if "position" not in bbox:
                return jsonify({"error": "Missing position"}), 400

        with open(annotation_path, "w") as f:
            json.dump(data, f, indent=2)

        return jsonify({"status": "ok"})


    app.run(debug=True) 



if __name__ == "__main__":
    argument_parser = argparse.ArgumentParser()
    argument_parser.add_argument("config", help="file path to the config file", type=str)

    args = argument_parser.parse_args()
    

    main(args)
