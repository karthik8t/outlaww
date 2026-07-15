from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Annotated, Any, Literal, Optional, Union
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _uuid() -> str:
    return uuid4().hex


def _prefixed_id(type_name: str, raw: str) -> str:
    """Ensure a tldraw record ID has the correct ``type_name:`` prefix."""
    if raw.startswith(type_name + ":"):
        return raw
    return f"{type_name}:{raw}"


# ===========================================================================
#  tldraw – store-level types
# ===========================================================================

# -- Vector ----------------------------------------------------------------

class Vec2(BaseModel):
    x: float = 0.0
    y: float = 0.0


# -- Common shape props -----------------------------------------------------

class GeoStyle(str, Enum):
    RECTANGLE = "rectangle"
    ELLIPSE = "ellipse"
    DIAMOND = "diamond"
    TRIANGLE = "triangle"
    TRAPEZOID = "trapezoid"
    PARALLELOGRAM = "parallelogram"
    RHOMBUS = "rhombus"
    HEXAGON = "hexagon"
    OCTAGON = "octagon"
    STAR = "star"
    ARROW = "arrow"
    PAGE = "page"
    CHECK_BOX = "check-box"


class ArrowBinding(BaseModel):
    boundShapeId: str = ""
    focus: float = 0.0
    normalizedAnchor: Vec2 = Vec2()
    edge: str = "middle"  # "middle" | "start" | "end"


class ArrowTerminal(BaseModel):
    type: str = "binding"  # "binding" | "point"
    boundShapeId: str = ""
    normalizedAnchor: Vec2 = Vec2()
    focus: float = 0.0
    isExact: bool = False
    point: Vec2 = Vec2()


class ArrowShapeProps(BaseModel):
    color: str = "black"
    labelColor: str = "black"
    fill: str = "none"
    dash: str = "draw"  # "draw" | "dashed" | "dotted" | "solid"
    size: str = "m"  # "s" | "m" | "l" | "xl"
    arrowheadStart: str = "none"
    arrowheadEnd: str = "arrow"
    text: str = ""
    start: ArrowTerminal = ArrowTerminal()
    end: ArrowTerminal = ArrowTerminal()
    bend: float = 0.0


class RectShapeProps(BaseModel):
    color: str = "black"
    labelColor: str = "black"
    fill: str = "none"
    dash: str = "draw"
    size: str = "m"
    geo: str = "rectangle"
    text: str = ""
    font: str = "draw"
    align: str = "middle"
    verticalAlign: str = "middle"
    growY: float = 0.0
    url: str = ""
    pdfPage: Optional[int] = None


class EllipseShapeProps(BaseModel):
    color: str = "black"
    labelColor: str = "black"
    fill: str = "none"
    dash: str = "draw"
    size: str = "m"
    text: str = ""
    font: str = "draw"
    align: str = "middle"
    verticalAlign: str = "middle"
    growY: float = 0.0


class TextShapeProps(BaseModel):
    color: str = "black"
    size: str = "m"
    font: str = "draw"
    align: str = "start"
    verticalAlign: str = "top"
    text: str = ""
    w: Optional[float] = None
    autoSize: bool = True
    scale: float = 1.0


class DrawShapeProps(BaseModel):
    color: str = "black"
    fill: str = "none"
    size: str = "m"
    segments: list[dict[str, Any]] = []
    isComplete: bool = False
    isPen: bool = False


class FrameShapeProps(BaseModel):
    color: str = "light-blue"
    name: str = ""


class GroupShapeProps(BaseModel):
    children: list[str] = []
    groupId: str = ""


class NoteShapeProps(BaseModel):
    color: str = "yellow"
    size: str = "m"
    font: str = "draw"
    align: str = "start"
    text: str = ""
    growY: float = 0.0
    isAdmonition: bool = False
    author: str = ""


class ImageShapeProps(BaseModel):
    assetId: str = ""
    w: float = 200
    h: float = 200
    crop: Optional[dict[str, Any]] = None
    flipX: bool = False
    flipY: bool = False
    url: str = ""


class VideoShapeProps(BaseModel):
    assetId: str = ""
    w: float = 300
    h: float = 200
    time: float = 0
    isPlaying: bool = False
    isMuted: bool = False
    volume: float = 1
    speed: float = 1


class BookmarkShapeProps(BaseModel):
    url: str = ""
    assetId: Optional[str] = None
    description: str = ""
    png: Optional[str] = None
    favIcon: Optional[str] = None


class EmbedShapeProps(BaseModel):
    url: str = ""
    w: float = 500
    h: float = 500


class LineShapeProps(BaseModel):
    color: str = "black"
    fill: str = "none"
    size: str = "m"
    dash: str = "draw"
    segments: list[dict[str, Any]] = []
    start: ArrowTerminal = ArrowTerminal()
    end: ArrowTerminal = ArrowTerminal()
    text: str = ""


class HighlightShapeProps(BaseModel):
    color: str = "yellow"
    size: str = "m"
    segments: list[dict[str, Any]] = []
    isComplete: bool = False


# -- Shape record -----------------------------------------------------------

class TLShape(BaseModel):
    """A single tldraw shape on a page."""
    id: str = Field(default_factory=_uuid)
    type: str  # rectangle | ellipse | arrow | text | draw | frame | group | note | image | video | bookmark | embed | line | highlight
    x: float = 0.0
    y: float = 0.0
    rotation: float = 0.0
    opacity: float = 1.0
    isLocked: bool = False
    parentId: str = ""  # page id
    index: str = "a0"   # z-ordering
    props: dict[str, Any] = Field(default_factory=dict)
    meta: dict[str, Any] = Field(default_factory=dict)
    bounds: Optional[dict[str, Any]] = None
    connecting: Optional[dict[str, Any]] = None
    updatedAt: float = 0.0
    createdAt: float = 0.0

    @field_validator("id", mode="before")
    @classmethod
    def _fix_id(cls, v: str) -> str:
        return _prefixed_id("shape", v)

    @field_validator("parentId", mode="before")
    @classmethod
    def _fix_parent(cls, v: str) -> str:
        if v and not v.startswith("page:"):
            return f"page:{v}"
        return v


# -- Asset record -----------------------------------------------------------

class TLAsset(BaseModel):
    """Media or bookmark asset attached to a tldraw document."""
    id: str = Field(default_factory=_uuid)
    type: str  # image | video | bookmark | embed
    typeName: Literal["asset"] = "asset"
    props: dict[str, Any] = Field(default_factory=dict)
    meta: dict[str, Any] = Field(default_factory=dict)
    createdAt: float = 0.0
    updatedAt: float = 0.0

    @field_validator("id", mode="before")
    @classmethod
    def _fix_id(cls, v: str) -> str:
        return _prefixed_id("asset", v)


# -- Page record ------------------------------------------------------------

class TLPage(BaseModel):
    """A single page (canvas) inside a tldraw document."""
    id: str = Field(default_factory=_uuid)
    name: str = "Page 1"
    typeName: Literal["page"] = "page"
    index: str = "a0"
    meta: dict[str, Any] = Field(default_factory=dict)

    @field_validator("id", mode="before")
    @classmethod
    def _fix_id(cls, v: str) -> str:
        return _prefixed_id("page", v)


# -- Camera / instance state ------------------------------------------------

class TLCamera(BaseModel):
    x: float = 0.0
    y: float = 0.0
    z: float = 1.0


class TLInstancePageState(BaseModel):
    focusedGroupId: Optional[str] = None
    hoveredShapeId: Optional[str] = None
    selectedIds: list[str] = []
    camera: TLCamera = TLCamera()
    scratch: Optional[dict[str, Any]] = None


class TLInstance(BaseModel):
    """Per-user presence state inside a tldraw document."""
    id: str = Field(default_factory=_uuid)
    typeName: Literal["instance"] = "instance"
    selectedIds: list[str] = []
    camera: TLCamera = TLCamera()
    screenBounds: Optional[dict[str, Any]] = None
    cursor: Optional[dict[str, Any]] = None
    following: Optional[str] = None
    name: str = ""
    color: str = ""
    meta: dict[str, Any] = Field(default_factory=dict)


# -- Document record --------------------------------------------------------

class TLDocument(BaseModel):
    """Root document record – holds pages, assets, and instance state."""
    id: str = Field(default_factory=_uuid)
    name: str = "Untitled"
    typeName: Literal["document"] = "document"
    gridSize: float = 10
    nameIsReadonly: bool = False
    meta: dict[str, Any] = Field(default_factory=dict)

    @field_validator("id", mode="before")
    @classmethod
    def _fix_id(cls, v: str) -> str:
        return _prefixed_id("document", v)


# -- Store (the full tldraw snapshot) ---------------------------------------

class TLStore(BaseModel):
    """Complete tldraw store snapshot."""
    document: TLDocument = TLDocument()
    page: dict[str, TLPage] = Field(default_factory=dict)
    shape: dict[str, TLShape] = Field(default_factory=dict)
    asset: dict[str, TLAsset] = Field(default_factory=dict)
    instance: dict[str, TLInstance] = Field(default_factory=dict)
    instance_page_state: dict[str, TLInstancePageState] = Field(default_factory=dict)


# ===========================================================================
#  Diagram – wraps a tldraw store as an artifact
# ===========================================================================

class Diagram(BaseModel):
    """A diagram artifact backed by a full tldraw store."""
    id: str = Field(default_factory=_uuid)
    name: str = ""
    description: str = ""
    store: TLStore = Field(default_factory=TLStore)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # -- convenience helpers ------------------------------------------------

    @property
    def page_ids(self) -> list[str]:
        return list(self.store.page.keys())

    @property
    def shape_count(self) -> int:
        return len(self.store.shape)

    def shapes_on_page(self, page_id: str) -> list[TLShape]:
        return [s for s in self.store.shape.values() if s.parentId == page_id]

    def add_shape(self, shape: TLShape, page_id: str | None = None) -> TLShape:
        if page_id:
            shape.parentId = page_id
        self.store.shape[shape.id] = shape
        self.updated_at = datetime.utcnow()
        return shape

    def remove_shape(self, shape_id: str) -> bool:
        removed = self.store.shape.pop(shape_id, None)
        if removed:
            self.updated_at = datetime.utcnow()
        return removed is not None

    def add_page(self, name: str = "Page") -> TLPage:
        page = TLPage(name=name)
        self.store.page[page.id] = page
        self.updated_at = datetime.utcnow()
        return page


# ===========================================================================
#  LLM-Friendly Shape Models (discriminated unions)
# ===========================================================================
# These are what the LLM actually generates.  Much simpler than TLShape —
# no index, meta, bounds, connecting, updatedAt, etc.  The conversion
# function `llm_shapes_to_store()` maps them to a proper TLStore.


class LLMGeoProps(BaseModel):
    """Props for geo shapes (rectangle, ellipse, diamond, triangle, …)."""
    geo: Literal[
        "rectangle", "ellipse", "diamond", "triangle", "trapezoid",
        "parallelogram", "rhombus", "hexagon", "octagon", "star",
    ] = "rectangle"
    text: str = ""
    color: Literal["black", "blue", "green", "orange", "yellow", "violet", "red"] = "black"
    fill: Literal["none", "semi", "solid"] = "none"
    w: float = 200
    h: float = 200


class LLMTextProps(BaseModel):
    """Props for standalone text labels."""
    text: str = ""
    color: Literal["black", "blue", "green", "orange", "yellow", "violet", "red"] = "black"
    size: Literal["s", "m", "l", "xl"] = "m"
    w: Optional[float] = None


class LLMArrowTerminal(BaseModel):
    """An arrow endpoint (point or binding)."""
    type: Literal["binding", "point"] = "binding"
    boundShapeId: str = ""
    normalizedAnchor: dict[str, float] = Field(
        default_factory=lambda: {"x": 0.5, "y": 0.5},
        description="Center of the shape",
    )
    isExact: bool = False


class LLMArrowProps(BaseModel):
    """Props for arrows connecting two shapes."""
    start: LLMArrowTerminal = LLMArrowTerminal()
    end: LLMArrowTerminal = LLMArrowTerminal()
    color: Literal["black", "blue", "green", "orange", "yellow", "violet", "red"] = "black"
    arrowheadEnd: Literal["none", "arrow", "triangle", "square", "dot"] = "arrow"
    arrowheadStart: Literal["none", "arrow", "triangle", "square", "dot"] = "none"
    text: str = ""


class LLMFrameProps(BaseModel):
    """Props for grouping frames."""
    name: str = ""
    w: float = 400
    h: float = 300


class LLMNoteProps(BaseModel):
    """Props for sticky notes."""
    text: str = ""
    color: Literal["yellow", "orange", "mint", "violet", "blue", "green", "red", "black"] = "yellow"
    size: Literal["s", "m", "l"] = "m"


# -- Base shape (shared fields) ---

class LLMShapeBase(BaseModel):
    """Fields every LLM shape must have."""
    id: str = Field(description="Unique shape ID, e.g. 'shape:box1' or 'box1' (prefix auto-added)")
    x: float = Field(default=0.0, description="X position on the page")
    y: float = Field(default=0.0, description="Y position on the page")

    @field_validator("id", mode="before")
    @classmethod
    def _fix_shape_id(cls, v: str) -> str:
        return _prefixed_id("shape", v)


# -- Concrete shape types ---

class LLMGeoShape(LLMShapeBase):
    type: Literal["geo"] = "geo"
    props: LLMGeoProps = LLMGeoProps()


class LLMTextShape(LLMShapeBase):
    type: Literal["text"] = "text"
    props: LLMTextProps = LLMTextProps()


class LLMArrowShape(LLMShapeBase):
    type: Literal["arrow"] = "arrow"
    props: LLMArrowProps = LLMArrowProps()


class LLMFrameShape(LLMShapeBase):
    type: Literal["frame"] = "frame"
    props: LLMFrameProps = LLMFrameProps()


class LLMNoteShape(LLMShapeBase):
    type: Literal["note"] = "note"
    props: LLMNoteProps = LLMNoteProps()


# -- Discriminated union ---

LLMShape = Annotated[
    Union[LLMGeoShape, LLMTextShape, LLMArrowShape, LLMFrameShape, LLMNoteShape],
    Field(discriminator="type"),
]


# ===========================================================================
#  LLM Output Models (what the LLM generates → list-based)
# ===========================================================================

class CreateDiagramOutput(BaseModel):
    """Output schema for the create_diagram agent.

    The LLM generates a *list* of shapes — far easier than a nested dict.
    The backend converts this to a proper TLStore via llm_shapes_to_store().
    """
    name: str = Field(default="", description="Title of the diagram")
    description: str = Field(default="", description="Short explanation of the diagram")
    shapes: list[LLMShape] = Field(
        default_factory=list,
        description="List of shapes in the diagram. Each shape has a type, position, and props.",
    )


class EditDiagramOutput(BaseModel):
    """Output schema for the edit_diagram agent."""
    shapes: list[LLMShape] = Field(
        default_factory=list,
        description="The COMPLETE set of shapes for the diagram after editing. "
                    "All existing shapes must be included (unchanged or modified), "
                    "plus any new shapes. Omitted shapes will be deleted.",
    )
    reasoning: str = ""


# ===========================================================================
#  Conversion: LLM list → proper TLStore
# ===========================================================================

def llm_shapes_to_store(
    shapes: list[LLMShape],
    *,
    name: str = "",
    description: str = "",
) -> TLStore:
    """Convert an LLM-generated shape list into a full TLStore.

    The LLM only worries about shapes — this function builds the
    document, page, and shape records that tldraw expects.
    """
    page_id = "page:page"

    store = TLStore(
        document=TLDocument(id="document:document", name=name or "Untitled", gridSize=10),
        page={page_id: TLPage(id=page_id, name="Page 1")},
    )

    for i, llm_shape in enumerate(shapes):
        # Build z-ordering index
        index = f"a{i:02d}"

        if isinstance(llm_shape, LLMGeoShape):
            shape = TLShape(
                id=llm_shape.id,
                type="geo",
                x=llm_shape.x,
                y=llm_shape.y,
                parentId=page_id,
                index=index,
                props=llm_shape.props.model_dump(mode="json"),
            )
        elif isinstance(llm_shape, LLMTextShape):
            shape = TLShape(
                id=llm_shape.id,
                type="text",
                x=llm_shape.x,
                y=llm_shape.y,
                parentId=page_id,
                index=index,
                props=llm_shape.props.model_dump(mode="json"),
            )
        elif isinstance(llm_shape, LLMArrowShape):
            # Convert LLM arrow terminals to TLShape props format
            start = llm_shape.props.start
            end = llm_shape.props.end
            arrow_props = {
                "color": llm_shape.props.color,
                "arrowheadStart": llm_shape.props.arrowheadStart,
                "arrowheadEnd": llm_shape.props.arrowheadEnd,
                "text": llm_shape.props.text,
                "start": {
                    "type": start.type,
                    "boundShapeId": start.boundShapeId,
                    "normalizedAnchor": start.normalizedAnchor,
                    "isExact": start.isExact,
                },
                "end": {
                    "type": end.type,
                    "boundShapeId": end.boundShapeId,
                    "normalizedAnchor": end.normalizedAnchor,
                    "isExact": end.isExact,
                },
            }
            shape = TLShape(
                id=llm_shape.id,
                type="arrow",
                x=llm_shape.x,
                y=llm_shape.y,
                parentId=page_id,
                index=index,
                props=arrow_props,
            )
        elif isinstance(llm_shape, LLMFrameShape):
            shape = TLShape(
                id=llm_shape.id,
                type="frame",
                x=llm_shape.x,
                y=llm_shape.y,
                parentId=page_id,
                index=index,
                props=llm_shape.props.model_dump(mode="json"),
            )
        elif isinstance(llm_shape, LLMNoteShape):
            shape = TLShape(
                id=llm_shape.id,
                type="note",
                x=llm_shape.x,
                y=llm_shape.y,
                parentId=page_id,
                index=index,
                props=llm_shape.props.model_dump(mode="json"),
            )
        else:
            # Unknown shape type — skip with warning
            continue

        store.shape[shape.id] = shape

    return store


def build_diagram_from_llm(
    shapes: list[LLMShape],
    *,
    name: str = "",
    description: str = "",
) -> Diagram:
    """Build a full Diagram from an LLM-generated shape list."""
    store = llm_shapes_to_store(shapes, name=name, description=description)
    return Diagram(name=name, description=description, store=store)


# ===========================================================================
#  Markdown Artifact
# ===========================================================================

class MarkdownFrontmatter(BaseModel):
    """YAML frontmatter block embedded in a markdown file."""
    title: str = ""
    description: str = ""
    author: str = ""
    tags: list[str] = []
    date: Optional[datetime] = None
    draft: bool = False
    slug: str = ""
    category: str = ""
    aliases: list[str] = []
    lang: str = "en"
    extra: dict[str, Any] = Field(default_factory=dict)


class MarkdownHeading(BaseModel):
    """A parsed heading node."""
    level: int  # 1-6
    text: str
    id: str = ""  # slug id for anchor links
    children: list[MarkdownHeading] = []


class MarkdownLink(BaseModel):
    text: str = ""
    url: str = ""
    is_image: bool = False


class MarkdownCodeBlock(BaseModel):
    language: str = ""
    content: str = ""


class MarkdownSection(BaseModel):
    """Top-level section delimited by an h1 or h2 heading."""
    heading: MarkdownHeading = MarkdownHeading(level=1, text="")
    content: str = ""
    subsections: list[MarkdownSection] = []


class MarkdownMetadata(BaseModel):
    """Computed metadata extracted from the content."""
    word_count: int = 0
    character_count: int = 0
    reading_time_minutes: float = 0.0
    heading_count: int = 0
    image_count: int = 0
    link_count: int = 0
    code_block_count: int = 0
    last_modified: Optional[datetime] = None


class MarkdownArtifact(BaseModel):
    """
    Industry-standard markdown document representation.

    Supports:
      - YAML frontmatter (Obsidian / Jekyll / Hugo / MDX compatible)
      - Raw content
      - Parsed AST-like sections, headings, links, and code blocks
      - Computed metadata
    """
    id: str = Field(default_factory=_uuid)
    title: str = ""
    file_path: Optional[str] = None  # optional disk path
    frontmatter: MarkdownFrontmatter = MarkdownFrontmatter()
    content: str = ""  # full raw markdown (excluding frontmatter)
    raw: str = ""  # original file content including frontmatter

    # -- parsed structure ---------------------------------------------------
    sections: list[MarkdownSection] = []
    headings: list[MarkdownHeading] = []
    links: list[MarkdownLink] = []
    code_blocks: list[MarkdownCodeBlock] = []

    # -- metadata -----------------------------------------------------------
    metadata: MarkdownMetadata = MarkdownMetadata()

    # -- tracking -----------------------------------------------------------
    tags: list[str] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # -- convenience --------------------------------------------------------

    @property
    def has_frontmatter(self) -> bool:
        return self.raw.startswith("---")

    def summary(self, max_chars: int = 200) -> str:
        """Return a plain-text summary of the content."""
        text = self.content
        # strip markdown syntax for a rough summary
        for ch in ("#", "*", "_", "`", "[", "]", "(", ")"):
            text = text.replace(ch, "")
        text = " ".join(text.split())
        if len(text) > max_chars:
            return text[:max_chars].rsplit(" ", 1)[0] + "..."
        return text


# ===========================================================================
#  Reflections – Agent Memory System
# ===========================================================================

class MemoryEntry(BaseModel):
    """A single memory unit with importance scoring and decay."""
    id: str = Field(default_factory=_uuid)
    content: str = ""
    source: str = ""  # where this memory came from
    importance: float = Field(default=0.5, ge=0.0, le=1.0)
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    tags: list[str] = []
    relations: list[str] = Field(default_factory=list)  # ids of related memories
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_accessed: Optional[datetime] = None
    access_count: int = 0
    embedding: Optional[list[float]] = None  # vector for semantic search


class SemanticMemory(BaseModel):
    """
    Factual knowledge the agent has learned about the world and project.
    Things that are generally true and persist across sessions.
    """
    facts: list[MemoryEntry] = []
    definitions: dict[str, str] = Field(default_factory=dict)  # term -> definition
    relationships: list[dict[str, Any]] = []  # entity-relation-entity triples

    def add_fact(self, content: str, **kwargs: Any) -> MemoryEntry:
        entry = MemoryEntry(content=content, **kwargs)
        self.facts.append(entry)
        return entry

    def query(self, keyword: str) -> list[MemoryEntry]:
        keyword_lower = keyword.lower()
        return [f for f in self.facts if keyword_lower in f.content.lower()]


class EpisodicMemory(BaseModel):
    """
    Time-ordered record of events, interactions, and decisions.
    Answers: "What happened?" and "When did we do X?"
    """
    events: list[MemoryEntry] = []

    def log_event(self, content: str, **kwargs: Any) -> MemoryEntry:
        entry = MemoryEntry(content=content, **kwargs)
        self.events.append(entry)
        return entry

    def recent(self, n: int = 10) -> list[MemoryEntry]:
        return self.events[-n:]

    def by_tag(self, tag: str) -> list[MemoryEntry]:
        return [e for e in self.events if tag in e.tags]


class ProceduralMemory(BaseModel):
    """
    How-to knowledge: workflows, patterns, commands, and conventions.
    Answers: "How do we do X in this project?"
    """
    steps: list[MemoryEntry] = []
    conventions: list[MemoryEntry] = []  # coding style, naming, etc.
    commands: list[MemoryEntry] = []  # shell commands, scripts, etc.

    def add_convention(self, content: str, **kwargs: Any) -> MemoryEntry:
        entry = MemoryEntry(content=content, **kwargs)
        self.conventions.append(entry)
        return entry

    def add_command(self, content: str, **kwargs: Any) -> MemoryEntry:
        entry = MemoryEntry(content=content, **kwargs)
        self.commands.append(entry)
        return entry


class ProjectContext(BaseModel):
    """
    What the agent knows about THIS project specifically.
    """
    name: str = ""
    description: str = ""
    goals: list[str] = []
    user_intentions: list[str] = []  # what the user wants to achieve
    tech_stack: list[str] = []
    architecture_notes: list[str] = []
    constraints: list[str] = []
    success_criteria: list[str] = []


class UserProfile(BaseModel):
    """
    What the agent knows about the user's preferences and patterns.
    """
    name: str = ""
    communication_style: str = ""  # formal / casual / technical
    preferred_patterns: list[str] = []
    pet_peeves: list[str] = []  # things the user dislikes
    expertise_level: str = ""  # beginner / intermediate / expert
    timezone: str = ""
    extra: dict[str, Any] = Field(default_factory=dict)


class Decision(BaseModel):
    """A record of an architectural or design decision."""
    id: str = Field(default_factory=_uuid)
    title: str = ""
    context: str = ""  # why this decision was needed
    decision: str = ""  # what was decided
    alternatives: list[str] = []
    consequences: list[str] = []
    status: str = "proposed"  # proposed | accepted | rejected | superseded
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Reflections(BaseModel):
    """
    Agent memory system – semantic, episodic, and project-aware.

    Serves as persistent context that helps the model understand:
    - What this project is about (ProjectContext)
    - Who the user is and what they want (UserProfile)
    - What the agent has learned (SemanticMemory)
    - What has happened (EpisodicMemory)
    - How things are done (ProceduralMemory)
    - What has been decided (Decisions)
    """
    project: ProjectContext = ProjectContext()
    user: UserProfile = UserProfile()
    semantic: SemanticMemory = SemanticMemory()
    episodic: EpisodicMemory = EpisodicMemory()
    procedural: ProceduralMemory = ProceduralMemory()
    decisions: list[Decision] = []

    # -- global state -------------------------------------------------------
    current_goals: list[str] = []
    active_blockers: list[str] = []
    open_questions: list[str] = []

    # -- interaction tracking -----------------------------------------------
    last_agent_used: str = ""
    last_intent_classified: str = ""
    total_interactions: int = 0
    artifacts_created: list[str] = Field(default_factory=list)  # ids of diagrams/docs
    artifacts_edited: list[str] = Field(default_factory=list)

    # -- helpers ------------------------------------------------------------

    def log(self, content: str, tags: list[str] | None = None, **kw: Any) -> MemoryEntry:
        """Log an event to episodic memory."""
        return self.episodic.log_event(content, tags=tags or [], **kw)

    def learn(self, content: str, **kw: Any) -> MemoryEntry:
        """Store a fact in semantic memory."""
        return self.semantic.add_fact(content, **kw)

    def decide(self, title: str, decision: str, **kw: Any) -> Decision:
        """Record an architectural/design decision."""
        d = Decision(title=title, decision=decision, **kw)
        self.decisions.append(d)
        return d

    def recall(self, query: str) -> list[MemoryEntry]:
        """Search across semantic memories."""
        return self.semantic.query(query)

    def recent_events(self, n: int = 10) -> list[MemoryEntry]:
        return self.episodic.recent(n)

    def snapshot_summary(self) -> str:
        """Compact text summary for injecting into agent instructions."""
        parts = []
        if self.project.name:
            parts.append(f"Project: {self.project.name}")
        if self.project.goals:
            parts.append(f"Goals: {', '.join(self.project.goals[:3])}")
        if self.current_goals:
            parts.append(f"Current goals: {', '.join(self.current_goals[:3])}")
        if self.active_blockers:
            parts.append(f"Blockers: {', '.join(self.active_blockers[:3])}")
        if self.open_questions:
            parts.append(f"Open questions: {', '.join(self.open_questions[:3])}")
        if self.user.expertise_level:
            parts.append(f"User expertise: {self.user.expertise_level}")
        if self.decisions:
            recent = self.decisions[-1]
            parts.append(f"Last decision: {recent.title} -> {recent.decision[:80]}")
        recent = self.recent_events(3)
        if recent:
            parts.append(f"Recent: {'; '.join(e.content[:60] for e in recent)}")
        return " | ".join(parts) if parts else "No context yet."


# ===========================================================================
#  Agent Output Schemas
# ===========================================================================


class CreateMarkdownOutput(BaseModel):
    """Deterministic output for the create_markdown agent."""
    title: str = ""
    frontmatter: MarkdownFrontmatter = MarkdownFrontmatter()
    content: str = ""
    sections: list[MarkdownSection] = []


class MarkdownEditOperation(BaseModel):
    """A single edit operation for markdown."""
    op: str  # replace_section | insert_section | remove_section | update_frontmatter | append_content | prepend_content
    heading_id: str = ""
    after_heading_id: str = ""
    new_content: str = ""
    patch: dict[str, Any] = Field(default_factory=dict)
    section: Optional[MarkdownSection] = None


class EditMarkdownOutput(BaseModel):
    """Deterministic output for the edit_markdown agent."""
    edits: list[MarkdownEditOperation] = []
    reasoning: str = ""


class ExplainerOutput(BaseModel):
    """Deterministic output for the explainer agent."""
    explanation: str = ""
    key_points: list[str] = []
    related_concepts: list[str] = []


class GapItem(BaseModel):
    """A single gap item."""
    topic: str = ""
    priority: str = "medium"  # high | medium | low
    reason: str = ""


class ConcernItem(BaseModel):
    """A single concern."""
    area: str = ""
    issue: str = ""
    severity: str = "medium"  # low | medium | high | critical


class SuggestionItem(BaseModel):
    """A single suggestion."""
    action: str = ""
    rationale: str = ""
    priority: str = "medium"


class GapSuggestionOutput(BaseModel):
    """Deterministic output for the gap_suggestion agent."""
    documentation_gaps: list[GapItem] = []
    diagram_gaps: list[GapItem] = []
    concerns: list[ConcernItem] = []
    suggestions: list[SuggestionItem] = []


class ResearchFinding(BaseModel):
    """A single research finding."""
    topic: str = ""
    details: str = ""
    sources: list[str] = []


class ResearchAlternative(BaseModel):
    """An alternative approach."""
    approach: str = ""
    pros: list[str] = []
    cons: list[str] = []


class ResearchOutput(BaseModel):
    """Deterministic output for the research agent."""
    summary: str = ""
    findings: list[ResearchFinding] = []
    alternatives: list[ResearchAlternative] = []
    recommendation: str = ""
    confidence: float = Field(default=0.5, ge=0.0, le=1.0)


# ===========================================================================
#  Router – agent routing enum + output
# ===========================================================================

class RouteTarget(str, Enum):
    """Deterministic routing target."""
    CREATE_DIAGRAM = "create_diagram"
    EDIT_DIAGRAM = "edit_diagram"
    PATCH_DIAGRAM = "patch_diagram"
    CREATE_MARKDOWN = "create_markdown"
    EDIT_MARKDOWN = "edit_markdown"
    EXPLAINER = "explainer"
    GAP_SUGGESTION = "gap_suggestion"
    RESEARCH = "research"
    ACTION = "action"           # maps to a predefined app action
    GENERIC = "generic"         # cannot be handled, return a friendly message


class RouterOutput(BaseModel):
    """Deterministic output for the router agent."""
    target: RouteTarget
    action_name: str = ""         # set when target == ACTION
    reasoning: str = ""
    unmodified_user_input: str = ""        # friendly message when target == GENERIC


# ===========================================================================
#  Predefined App Actions
# ===========================================================================

class AppAction(BaseModel):
    """A predefined action the application can perform."""
    name: str
    description: str
    default_agent: str = ""       # which agent handles this
    default_params: dict[str, Any] = Field(default_factory=dict)
    trigger_keywords: list[str] = Field(default_factory=list)
    examples: list[str] = Field(default_factory=list)


class ActionResult(BaseModel):
    """Result of executing a predefined action."""
    action_name: str = ""
    success: bool = True
    message: str = ""
    data: Any = None


# ===========================================================================
#  Reflection Agent Output
# ===========================================================================

class ReflectionUpdate(BaseModel):
    """A single update to apply to the reflection state."""
    field: str        # e.g. "project.goals", "user.expertise_level", "current_goals"
    action: str       # set | append | remove
    value: Any = None


class ReflectionOutput(BaseModel):
    """Deterministic output for the reflection agent.

    Runs after every main agent to update the persistent memory/state.
    """
    summary: str = ""
    updates: list[ReflectionUpdate] = []
    new_goals: list[str] = []
    new_blockers: list[str] = []
    new_open_questions: list[str] = []
    learnings: list[str] = []           # facts to store in semantic memory
    decisions_made: list[dict[str, Any]] = []  # decisions to record
    log_entries: list[str] = []         # events to log to episodic memory


# ===========================================================================
#  Session State (top-level)
# ===========================================================================

class SessionState(BaseModel):
    """Full state for a single user session."""
    project_name: str = ""
    project_description: str = ""
    diagrams: list[Diagram] = []
    markdown: list[MarkdownArtifact] = []
    active_artifact_id: str = ""
    reflection: Reflections = Reflections()
    user_id: str = ""
    session_id: str = Field(default_factory=_uuid)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


# ===========================================================================
#  State Schema – ADK state validation for the workflow
# ===========================================================================

class StateSchema(BaseModel):
    """Pydantic model declaring expected state keys and types.

    Used by ADK's Workflow state_schema parameter to validate that
    workflow nodes only write declared keys. Prefixed keys (app:, user:,
    temp:) bypass validation automatically.
    """
    # Workflow routing
    user_message: str = ""
    routing: dict[str, Any] = Field(default_factory=dict)
    routing_target: str = ""
    router_context: str = ""
    dispatch_result: dict[str, Any] = Field(default_factory=dict)

    # Reflection / memory
    reflection: dict[str, Any] = Field(default_factory=dict)

    # Persisted artifacts
    diagrams: list[dict[str, Any]] = Field(default_factory=list)
    markdown_docs: list[dict[str, Any]] = Field(default_factory=list)
    active_ids: dict[str, str] = Field(default_factory=dict)
