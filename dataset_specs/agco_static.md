# AGCO Static Scene Point Cloud Dataset Specification

This document describes the overall structure of point cloud datasets captured in static environments. The datasets are intended to be used for training of geometric deep learning and efficient annotation in superimposed views.

---

## 1. File Structure

Files are organized by scene, then by sensor. Each file uses a zero-padded 4-digit index (e.g. `000001`, `000002`) to denote synchronized captures across all sensors — meaning `coord_000002.npy`, `image_000002.npy`, and `meta_000002.json` all correspond to the same point in time, without requiring timestamp comparisons at later stages.

```
dataset/
├── dataset_meta.json                   
│
├── scene_001/
│   ├── scene_meta.json                 
│   ├── scene_bboxes.json               
│   │
│   ├── ls_lidar/                       
│   │   ├── coords/
│   │   │   ├── coord_000001.npy          
│   │   │   └── coord_000002.npy
│   │   ├── segment/
│   │   │   ├── segment_000001.npy        
│   │   │   └── segment_000002.npy
│   │   ├── instances/
│   │   │   ├── instance_000001.npy       
│   │   │   └── instance_000002.npy
│   │   ├── transforms/
│   │   │   ├── transform_000001.npy      
│   │   │   └── transform_000002.npy
│   │   ├── meta/
│   │   │   ├── meta_000001.json          
│   │   │   └── meta_000002.json
│   │   └── bounding_boxes/
│   │       ├── bboxes_000001.json        
│   │       └── bboxes_000002.json
│   │
│   ├── os_lidar/                       
│   │   ├── coords/
│   │   ├── segment/
│   │   ├── instances/
│   │   ├── transforms/
│   │   ├── meta/
│   │   └── bounding_boxes/
│   │
│   └── camera_sensor_x/               
│       ├── images/
│       │   ├── image_0001.npy          
│       │   └── image_0002.npy
│       ├── meta/
│       │   ├── meta_0001.json
│       │   └── meta_0002.json
│       └── dino_{model}_feat/          
│           ├── dino_0001.npy
│           └── dino_0002.npy
│
├── scene_002/
│   └── ...
└── ...
```

---

## 2. Index Synchronization

All files sharing an index number (e.g. `_0002`) are captured at the same timestamp. This convention eliminates the need to match timestamps across sensors during data loading. When loading a frame, use the index as the sole join key across all modalities.

| Index | LS LiDAR | OS LiDAR | Camera |
|-------|----------|----------|--------|
| `0001` | `coord_000001.npy`, `meta_000001.json`, ... | `coord_000001.npy`, ... | `image_000001.npy`, ... |
| `0002` | `coord_000002.npy`, `meta_000002.json`, ... | `coord_000002.npy`, ... | `image_000002.npy`, ... |

---

## 3. JSON Schemas

Multiple JSON files are used throughout the dataset. Each must follow a minimum schema for compatibility. Fields marked `*` are required.

### 3.1 `dataset_meta.json`

Top-level file containing metadata for the entire dataset: sensor extrinsics, intrinsics, a list of sensors and source rosbags, and the label-to-integer mapping used across all annotations.

```json
{
  "sensor_extrinsics": {
    "rtk_to_ls": [[4, 4]],
    "cam_1_to_ls": [[4, 4]],
    "..."
  },
  "sensor_intrinsics": {
    "cam_1": [[3, 3]],
    "cam_2": [[3, 3]],
    "..."
  },
  "sensors": ["ls_lidar", "os_lidar", "camera_sensor_1"],
  "rosbags": ["capture_001.bag", "capture_002.bag"],
  "label_name_dict": {
    "background": 0,
    "tractor": 1,
    "harvester": 2,
    "..."
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `sensor_extrinsics` * | object | 4×4 transform matrices from each sensor to the reference sensor |
| `sensor_intrinsics` * | object | 3×3 camera intrinsic matrices per camera sensor |
| `sensors` * | string[] | List of sensor identifiers present in this dataset |
| `rosbags` * | string[] | Source rosbag filenames for the entire dataset |
| `label_name_dict` * | object | Human-readable label name → integer class mapping |

---

### 3.2 `scene_meta.json`

Per-scene file describing which rosbags and vehicles are present, along with any free-text notes.

```json
{
  "rosbags": ["capture_003.bag"],
  "vehicles": ["tractor_A", "harvester_B"],
  "extra_notes": "Overcast lighting. Tractor partially occluded by harvester in frames 0010-0015."
}
```

| Field | Type | Description |
|-------|------|-------------|
| `rosbags` * | string[] | Source rosbags for this scene |
| `vehicles` * | string[] | Vehicle identifiers visible in this scene |
| `extra_notes` | string | Optional free-text annotation notes |

---

### 3.3 `scene_bboxes.json`

Global bounding boxes annotated in the superimposed/global coordinate frame. These can be propagated back into local sensor views. Position and orientation are in the global reference frame. Scaling represents the full extents of the box (not half-extents).

```json
{
  "bboxes": [
    {
      "position": [-6.108, 8.537, -3.306],
      "rotationQuaternion": [0.099, -0.090, -0.731, 0.669],
      "scaling": [1.283, 0.841, 0.623],
      "base_size": 5,
      "label": 1,
      "instance": 2,
      "note": "small tractor with forks"
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `bboxes` * | object[] | List of bounding box objects |
| `position` * | float[3] | XYZ center position in global coordinates |
| `rotationQuaternion` * | float[4] | Orientation as quaternion `[x, y, z, w]` |
| `scaling` * | float[3] | Full box extents in XYZ (meters) |
| `base_size` * | float | Reference size used to normalize the box |
| `label` * | int | Integer class label (see `label_name_dict`) |
| `instance` * | int | Unique instance identifier within the scene |
| `note` | string | Optional human-readable description |

---

### 3.4 `meta_xxxxxx.json`

Per-frame metadata file for each sensor modality. Links each frame back to its source rosbag and original timestamp.

```json
{
  "rosbag": "capture_003.bag",
  "timestamp": 1712345678.123456
}
```

| Field | Type | Description |
|-------|------|-------------|
| `rosbag` * | string | Filename of the source rosbag |
| `timestamp` * | float | Unix timestamp (seconds, with microsecond precision) |

---

### 3.5 `bboxes_xxxxxx.json`

Per-frame local bounding boxes, expressed in the coordinate frame of the LiDAR sensor for that frame. Each box includes inlier point counts and visibility flags, which can be used to filter training samples by difficulty.

> **Note:** The precise schema for this file is still being finalized. The fields below represent the intended minimum.

```json
{
  "bboxes": [
    {
      "position": [1.234, -0.456, 0.789],
      "rotationQuaternion": [0.0, 0.0, 0.707, 0.707],
      "scaling": [1.283, 0.841, 0.623],
      "label": 1,
      "instance": 2,
      "inlier_points": 412,
      "is_visible": true,
      "note": "small tractor with forks"
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `bboxes` * | object[] | List of local bounding box objects |
| `position` * | float[3] | XYZ center in LiDAR-local coordinates |
| `rotationQuaternion` * | float[4] | Orientation quaternion `[x, y, z, w]` |
| `scaling` * | float[3] | Full box extents in XYZ (meters) |
| `label` * | int | Integer class label |
| `instance` * | int | Instance identifier (matches global scene bbox) |
| `inlier_points` * | int | Number of point cloud points inside the box |
| `is_visible` * | bool | Whether the object is unoccluded in this frame |
| `note` | string | Optional free-text description |

---

## 4. NumPy Array Conventions

All `.npy` files follow consistent shape and dtype conventions.

| File | Shape | Dtype | Description |
|------|-------|-------|-------------|
| `coord_xxxx.npy` | `(N, 3)` | `float32` | XYZ coordinates per point |
| `segment_xxxx.npy` | `(N,)` | `int32` | Semantic class label per point |
| `instance_xxxx.npy` | `(N,)` | `int32` | Instance ID per point |
| `transform_xxxx.npy` | `(4, 4)` | `float64` | Sensor-to-global homogeneous transform |
| `image_xxxx.npy` | `(H, W, 3)` | `uint8` | RGB image array |
| `dino_xxxx.npy` | `(H', W', D)` | `float16` | DINOv3 patch feature embeddings |

**Coordinate system:** Right-handed, Z-up. Units are meters.

---

## 5. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Scene directories | `scene_NNN` (zero-padded 3 digits) | `scene_001` |
| Frame index | `_XXXXXX` (zero-padded 6 digits) | `coord_000012.npy` |
| LiDAR sensors | `{model}_lidar` | `ls_lidar`, `os_lidar` |
| Camera sensors | `camera_sensor_{id}` | `camera_sensor_1` |
| DINO features | `dino_{model}_feat/` | `dino_vitb14_feat/` |

---


