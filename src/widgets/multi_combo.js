// File: src/widgets/MultiComboWidget.js

class MultiComboWidget extends LiteGraph.LGraphWidget {
    constructor(type, title, value, callback, options) {
        super(type, title, value, callback, options);
        this.selectedValues = new Set();
        this.opened = false;
        this.hoveredOption = -1;

        // Initialize selected values
        if (Array.isArray(value)) {
            value.forEach(val => this.selectedValues.add(val));
        }
    }

    onDrawBackground(ctx) {
        // Optional: Draw widget background if needed
    }

    onDrawForeground(ctx) {
        // Draw the main widget as a combo box
        ctx.fillStyle = "#FFFFFF";
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1;
        ctx.fillRect(0, 0, this.size[0], this.size[1]);
        ctx.strokeRect(0, 0, this.size[0], this.size[1]);

        // Display selected items
        const text = Array.from(this.selectedValues).join(", ") || "Select...";
        ctx.fillStyle = "#000000";
        ctx.font = "14px Arial";
        ctx.textBaseline = "middle";
        ctx.fillText(text, 5, this.size[1] / 2);

        // Draw the dropdown arrow
        ctx.beginPath();
        ctx.moveTo(this.size[0] - 15, this.size[1] / 2 - 5);
        ctx.lineTo(this.size[0] - 5, this.size[1] / 2 - 5);
        ctx.lineTo(this.size[0] - 10, this.size[1] / 2 + 5);
        ctx.closePath();
        ctx.fillStyle = "#000000";
        ctx.fill();

        // If opened, draw the options
        if (this.opened && this.optionsPanel) {
            ctx.fillStyle = "#FFFFFF";
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 1;
            ctx.fillRect(this.optionsPanel.x, this.optionsPanel.y, this.optionsPanel.width, this.optionsPanel.height);
            ctx.strokeRect(this.optionsPanel.x, this.optionsPanel.y, this.optionsPanel.width, this.optionsPanel.height);

            // Draw each option with checkbox
            this.optionsPanel.values.forEach((value, index) => {
                const optionY = this.optionsPanel.y + index * 25;
                const checkboxSize = 15;

                // Checkbox
                ctx.fillStyle = this.selectedValues.has(value) ? "#000000" : "#FFFFFF";
                ctx.fillRect(this.optionsPanel.x + 5, optionY + 5, checkboxSize, checkboxSize);
                ctx.strokeRect(this.optionsPanel.x + 5, optionY + 5, checkboxSize, checkboxSize);

                // Option text
                ctx.fillStyle = "#000000";
                ctx.font = "14px Arial";
                ctx.textBaseline = "middle";
                ctx.fillText(value, this.optionsPanel.x + 25, optionY + 12.5);
            });
        }
    }

    onMouseDown(event, local_pos, graphCanvas) {
        if (!this.opened) {
            // Open the dropdown
            this.opened = true;
            this.updateOptionsPanel();
            graphCanvas.setDirty();
            return true;
        } else {
            // If clicked inside options panel, handle selection
            if (this.optionsPanel) {
                const { x, y, width, height, values } = this.optionsPanel;
                const absoluteX = event.canvasX;
                const absoluteY = event.canvasY;
                const relativeX = absoluteX - x;
                const relativeY = absoluteY - y;

                if (relativeX >= 0 && relativeX <= width && relativeY >= 0 && relativeY <= height) {
                    const index = Math.floor(relativeY / 25);
                    if (index >= 0 && index < values.length) {
                        const value = values[index];
                        if (this.selectedValues.has(value)) {
                            this.selectedValues.delete(value);
                        } else {
                            this.selectedValues.add(value);
                        }
                        // Trigger callback with updated selection
                        if (this.callback) {
                            this.callback(Array.from(this.selectedValues));
                        }
                        this.setDirtyCanvas(true);
                        return true;
                    }
                }
            }

            // Otherwise, close the dropdown
            this.opened = false;
            this.setDirtyCanvas(true);
            return true;
        }
    }

    onMouseUp(event, local_pos, graphCanvas) {
        // No action on mouse up
    }

    onMouseMove(event, local_pos, graphCanvas) {
        // Handle hover over options if needed
    }

    onBlur() {
        // Close the dropdown when the widget loses focus
        this.opened = false;
        this.setDirtyCanvas(true);
    }

    updateOptionsPanel() {
        // Position the options panel below the widget
        this.optionsPanel = {
            x: this.pos[0],
            y: this.pos[1] + this.size[1],
            width: this.size[0],
            height: Math.min(this.options.values.length * 25, 200),
            values: this.options.values
        };
    }

    serialize() {
        return Array.from(this.selectedValues);
    }

    configure(value) {
        this.selectedValues = new Set(value);
    }
}

// Register the custom widget type under "test/multi_combo"
LiteGraph.registerWidgetType("test/multi_combo", MultiComboWidget);
console.log("MultiComboWidget - Registered as 'test/multi_combo'");
