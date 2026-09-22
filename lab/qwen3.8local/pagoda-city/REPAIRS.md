Two one-line fixes applied by Wesche to make the as-shipped file run (artifact.original.html = untouched output):
1. line 614: `0xffa martin=0,0,` -> `0xffa040,0,` (corrupted hex literal -> SyntaxError, module never ran)
2. line 299: `return e.mesh;` -> `return meshStore[kind].mesh;` (stale local after first allocation -> TypeError on first bake)
