One edit applied by Wesche (index.html = untouched output, repaired/index.html = edited):
line 599/830/834: a `let surfCap` counter collided with the `function surfCap()` declared on line 324 -> SyntaxError, script never ran. Renamed the counter to surfCapN.
Still broken after the edit, not repaired: the mesh builder stores ring coordinates (ringF/ringR/ringP return [x,y,z] arrays) but every edge()/spokes()/radial() call treats them as node indices -> TypeError on the first edge; the simulation never initialises and no canvas is created. Status stays "WEBGPU · INIT". Recorded as-is.
