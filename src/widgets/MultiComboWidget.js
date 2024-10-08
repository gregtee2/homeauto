// File: src/widgets/MultiComboWidget.js

class MultiComboWidget extends LiteGraph.Widget {
    constructor(title, options) {
        super(title, options);
        this.options = options || {};
        this.values = this.options.values || []; // Array of { id: '1', name: 'Light 1' }
        this.selected = this.options.selected || []; // Array of selected IDs
        this.open = false; // Dropdown visibility state

        // Bind event handlers
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.render = this.render.bind(this);

        // Attach event listeners
        this.canvas = null; // Will be set during render
    }

    onMouseDown(event, widget, canvas, pos) {
        this.open = !this.open;
        this.setDirty(true);
        return true;
    }

    onMouseUp(event, widget, canvas, pos) {
        if (this.open) {
            const relativeY = event.canvas.y - (this.pos[1] + this.size[1]);
            const index = Math.floor(relativeY / 20);
            if (index >= 0 && index < this.values.length) {
                const item = this.values[index];
                const idx = this.selected.indexOf(item.id);
                if (idx > -1) {
                    this.selected.splice(idx, 1);
                } else {
                    this.selected.push(item.id);
                }
                this.value = this.selected.join(", ");
                this.setDirty(true);
                // Emit change event
                if (this.onChange) {
                    this.onChange(this.value);
                }
            }
            this.open = false;
            this.setDirty(true);
            return true;
        }
        return false;
    }

    render(ctx, graph_canvas, widget_info) {
        this.canvas = graph_canvas;
        ctx.fillStyle = "#EEE";
        ctx.fillRect(this.pos[0], this.pos[1], this.size[0], this.size[1]);

        ctx.strokeStyle = "#555";
        ctx.strokeRect(this.pos[0], this.pos[1], this.size[0], this.size[1]);

        ctx.fillStyle = "#000";
        ctx.font = "12px Arial";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(this.value || "Select Devices", this.pos[0] + 5, this.pos[1] + this.size[1] / 2);

        if (this.open) {
            ctx.fillStyle = "#FFF";
            ctx.fillRect(this.pos[0], this.pos[1] + this.size[1], this.size[0], this.values.length * 20);

            ctx.strokeStyle = "#555";
            ctx.strokeRect(this.pos[0], this.pos[1] + this.size[1], this.size[0], this.values.length * 20);

            this.values.forEach((item, index) => {
                const y = this.pos[1] + this.size[1] + index * 20;
                ctx.fillStyle = "#000";
                ctx.fillText(item.name, this.pos[0] + 5, y + 10);

                // Draw checkbox
                ctx.fillStyle = this.selected.includes(item.id) ? "#0F0" : "#FFF";
                ctx.fillRect(this.pos[0] + this.size[0] - 15, y + 5, 10, 10);
                ctx.strokeStyle = "#000";
                ctx.strokeRect(this.pos[0] + this.size[0] - 15, y + 5, 10, 10);
            });
        }
    }

    serialize() {
        return {
            selected: this.selected
        };
    }

    configure(data) {
        if (data.selected) {
            this.selected = data.selected;
            this.value = this.selected.join(", ");
        }
    }
}

// Register the widget with LiteGraph
LiteGraph.registerWidgetType("combo/multi_combo", MultiComboWidget);
console.log("MultiComboWidget - Registered as 'combo/multi_combo'");
