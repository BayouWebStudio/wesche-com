One edit applied by Wesche so the as-shipped file draws anything (index.html = untouched output, repaired/index.html = edited):
getViewMatrix(): the third row of the view matrix used +forward and -(fwd·eye); WebGPU/GL convention is -forward and +(fwd·eye). Four sign flips on lines 2656-2668. Without it the wedge is behind the camera and the canvas stays empty.
Still broken after the edit, not repaired: the tetrahedral surface extraction leaves large holes in the mesh and the camera radius (5.2) places the eye inside the wedge. Recorded as-is.
