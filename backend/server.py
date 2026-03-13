from flask import Flask, Response, send_from_directory
import numpy as np
import open3d as o3d 
from pathlib import Path

from flask_compress import Compress

from backend.loaders.dataset_loader import lidar_loader


dataset_dir = "/media/ai/T7/agco_ttcbtg/val/multibag_2025-10-22-11-27-26_5_annotation2025-10-22-11-28-26_6_annotation2025-10-22-11-29-26_7_annotation/_lslidar_point_cloud/"

dataset = lidar_loader(dataset_dir)


points = np.array(dataset.point.positions.numpy(), dtype=np.float16)
normals = np.array(dataset.point.normals.numpy(), dtype=np.float16)

print(points.shape)

app = Flask(__name__, static_folder="static")

# generate point cloud in RAM


Compress(app)

CHUNK_SIZE = 200_000

app = Flask(
    __name__,
    static_folder=Path("../frontend/static"),
    static_url_path="" 
)

@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/points/<int:chunk>")
def stream_points(chunk):

    start = chunk * CHUNK_SIZE
    end = min(start + CHUNK_SIZE, len(points))

    if start >= len(points):
        return Response(status=204)

    # data = points[start:end]
    #
    # return Response(data.tobytes(), mimetype="application/octet-stream")
    data = np.hstack([points[start:end], normals[start:end]]).astype(np.float16)


    return Response(data.tobytes(), mimetype="application/octet-stream")

if __name__ == "__main__":
    app.run(debug=True) 
