
let COLOURS = ["#e7e3e1"];
let radius = 2;

Sketch.create({
    container: document.getElementById("sketchable"),
    autoclear: false,
    retina: "auto",

    update: function () {
        radius = 2;
    },

    keydown: function () {
        if (this.keys.C) this.clear();
    },

    click: function () {
        if (this.click) this.clear();
    },

    touchmove: function () {
        for (var i = this.touches.length - 1, touch; i >= 0; i--) {
            touch = this.touches[i];

            this.lineCap = "round";
            this.lineJoin = "round";
            this.fillStyle = this.strokeStyle = COLOURS[i % COLOURS.length];
            this.lineWidth = radius;

            this.beginPath();
            this.moveTo(touch.ox, touch.oy);
            this.lineTo(touch.x, touch.y);
            this.stroke();
        }
    }
});
