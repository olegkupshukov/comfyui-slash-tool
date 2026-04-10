# ComfyUI Slash Tool 🔪

A Houdini-inspired blade tool for cutting node connections in ComfyUI. Instead of manually clicking each wire, simply draw a slash across multiple connections to cut them all at once.

## Demo
Press **X** → drag across wires → all intersected connections are instantly removed.

## Installation

### Manual
```bash
cd ComfyUI/custom_nodes
git clone https://github.com/olegkupshukov/comfyui-slash-tool
```
Restart ComfyUI.

## Usage
| Action | Result |
|--------|--------|
| Press **X** | Enter slash mode (cursor changes to blade) |
| **LMB drag** | Draw slash line across wires |
| Release **LMB** | Cut all intersected connections |
| **RMB** / **Middle click** / **Any key** | Exit slash mode |

## Inspired by
Houdini's Y tool for cutting node connections.

## License
MIT — free to use in any project.
