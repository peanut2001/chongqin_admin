"""AI 判读（演示版）。

目前没有接入真实模型：示例图片返回预置的演示结果，上传图片返回通用演示结果。
接入真实模型时只需替换 analyze()，并把 RESULT_SOURCE 改为 'model:<名称>'。
"""

from app.models import AiSample

RESULT_SOURCE = "demo"
DISCLAIMER = "演示结果，非真实 AI 模型输出，仅用于教学流程演示。"


def analyze(modality: str, sample: AiSample | None = None) -> dict:
    if sample is not None:
        return sample.demo_result
    return {
        "findings": [
            {
                "label": f"{modality}：可疑异常区域 1",
                "confidence": 0.82,
                "box": {"x": 30, "y": 30, "w": 20, "h": 18},
            },
            {
                "label": f"{modality}：可疑异常区域 2",
                "confidence": 0.58,
                "box": {"x": 58, "y": 52, "w": 14, "h": 12},
            },
        ],
        "impression": "检测到可疑异常区域（演示结果），请结合临床资料及上级医师意见综合判断。",
        "suggestions": ["对照病例库中相似病例", "与带教老师讨论判读结果"],
        "elapsedMs": 1500,
    }
