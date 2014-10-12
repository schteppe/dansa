DANSA.Actor = function (context, imgUrl, fileInfo, props) {
    this.context = context;
    this.props = {
        x: 0,
        y: 0,
        scaleX: 0,
        scaleY: 0,
        rotation: 0,
        alpha: 1,
        frameIndex: 0
    };
    DANSA.Utils.merge(this.props, props);

    this.sprite = Sprite(imgUrl, fileInfo);
    this.queuedKeyFrames = [];
    this.durationSeconds = undefined;
    this.intoAnimationSeconds = undefined;
    this.beginProps = undefined;
    this.endProps = undefined;
};

DANSA.Actor.prototype.draw = function () {
    this.sprite.draw(this.context, this.props.frameIndex, this.props.x, this.props.y, this.props.scaleX, this.props.scaleY, this.props.rotation, this.props.alpha);
};

DANSA.Actor.prototype.update = function (deltaSeconds) {
    if (this.queuedKeyFrames.length > 0) {
        if (undefined === this.durationSeconds) {
            var keyFrame = this.queuedKeyFrames.shift();
            this.durationSeconds = keyFrame.durationSeconds;
            this.intoAnimationSeconds = 0;
            this.beginProps = DANSA.Utils.deepCopy(this.props);
            this.endProps = DANSA.Utils.deepCopy(keyFrame.props);
        }
    }
    if (undefined !== this.durationSeconds) {
        this.intoAnimationSeconds += deltaSeconds;
        var percentThrough = this.intoAnimationSeconds / this.durationSeconds;
        if (percentThrough >= 1) {
            DANSA.Utils.merge(this.props, this.endProps);
            this._endKeyframe();
        } else {
            var attrs = Object.keys(this.endProps);
            for (var i = 0; i < attrs.length; i++) {
                var attr = attrs[i];
                this.props[attr] = this.beginProps[attr] + (this.endProps[attr] - this.beginProps[attr]) * percentThrough;
            }
            /*
            for (var attr in this.endProps) {
                this.props[attr] = this.beginProps[attr] + (this.endProps[attr] - this.beginProps[attr]) * percentThrough;
            }
            */
        }
    }
};

DANSA.Actor.prototype.set = function (props) {
    DANSA.Utils.merge(this.props, props);
    return this;
};

DANSA.Actor.prototype.animate = function (props, sec) {
    var keyFrame = {
        props: DANSA.Utils.deepCopy(props),
        durationSeconds: sec,
    };
    this.queuedKeyFrames.push(keyFrame);
    return this;
};

DANSA.Actor.prototype.stop = function () {
    this._endKeyframe();
    this.queuedKeyFrames = [];
    return this;
};

DANSA.Actor.prototype.finish = function () {
    this._endKeyframe();
    this.queuedKeyFrames = [];
    return this;
};

DANSA.Actor.prototype._endKeyframe = function () {
    this.durationSeconds = undefined;
    this.intoAnimationSeconds = undefined;
    this.beginProps = undefined;
    this.endProps = undefined;
};
