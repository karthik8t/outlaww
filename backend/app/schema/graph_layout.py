"""D2 Size Hints.

D2 handles all layout automatically via ELK engine.
This module provides optional size hints for specific shapes.
"""
from __future__ import annotations

from typing import Literal

ShapeType = Literal[
    "rectangle", "square", "page", "parallelogram", "document",
    "cylinder", "queue", "package", "step", "callout", "stored_data",
    "person", "diamond", "oval", "circle", "hexagon", "cloud",
    "sql_table", "sequence_diagram", "class", "text", "grid",
]


# Default size hints per shape (D2 uses these as minimums)
SHAPE_SIZES: dict[ShapeType, tuple[int, int]] = {
    "rectangle": (180, 60),
    "square": (80, 80),
    "page": (160, 200),
    "parallelogram": (180, 60),
    "document": (160, 200),
    "cylinder": (60, 100),
    "queue": (180, 60),
    "package": (160, 100),
    "step": (180, 60),
    "callout": (180, 80),
    "stored_data": (160, 80),
    "person": (60, 100),
    "diamond": (100, 80),
    "oval": (120, 80),
    "circle": (80, 80),
    "hexagon": (100, 90),
    "cloud": (180, 100),
    "sql_table": (200, 40),   # Header height; rows added automatically
    "sequence_diagram": (400, 300),
    "class": (200, 150),
    "text": (200, 100),
    "grid": (300, 200),
}


def get_shape_size(shape: str) -> tuple[int, int]:
    """Get default (width, height) for a shape type."""
    return SHAPE_SIZES.get(shape, (180, 60))


def estimate_label_size(label: str, shape: str) -> tuple[int, int]:
    """
    Estimate size needed for a label in a given shape.
    D2 will auto-size, but this can be used for initial container sizing.
    """
    base_w, base_h = get_shape_size(shape)
    if not label:
        return base_w, base_h

    # Rough character width
    char_w = 9
    label_w = len(label) * char_w + 40
    return max(label_w, base_w), base_h


# No layout computation - D2 handles all positioning
# This module only provides size hints for container initialization