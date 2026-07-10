import { describe, it, expect } from "vitest";
import { getSfcBlocks, updateSfcBlock } from "../src/editor";

describe("getSfcBlocks", () => {
  it('reads <script> with lang="ts" and offsets point to outer <script>...</script>', () => {
    const sfc = `<template><div /></template>\n<script lang="ts">\nconst a: number = 1\n</script>\n`;
    const blocks = getSfcBlocks(sfc, "Foo.vue");
    expect(blocks.script).toBeDefined();
    expect(blocks.script!.kind).toBe("script");
    expect(blocks.script!.content).toBe("\nconst a: number = 1\n");
    expect(sfc.slice(blocks.script!.start, blocks.script!.end)).toBe(
      `<script lang="ts">\nconst a: number = 1\n</script>`,
    );
    expect(blocks.style).toBeUndefined();
  });

  it("prefers <script setup> over <script> when both present", () => {
    const sfc = `<script>const a = 1</script>\n<script setup lang="ts">const b = 2</script>\n`;
    const blocks = getSfcBlocks(sfc, "Foo.vue");
    expect(blocks.script).toBeDefined();
    expect(blocks.script!.content).toBe("const b = 2");
    expect(sfc.slice(blocks.script!.start, blocks.script!.end)).toBe(
      `<script setup lang="ts">const b = 2</script>`,
    );
  });

  it("reads <style scoped> with attrs preserved", () => {
    const sfc = `<template><div class="x" /></template>\n<style scoped>\n.x { color: red }\n</style>\n`;
    const blocks = getSfcBlocks(sfc, "Foo.vue");
    expect(blocks.style).toBeDefined();
    expect(blocks.style!.content).toBe("\n.x { color: red }\n");
    expect(sfc.slice(blocks.style!.start, blocks.style!.end)).toBe(
      `<style scoped>\n.x { color: red }\n</style>`,
    );
  });

  it("returns empty object when SFC has neither <script> nor <style>", () => {
    const sfc = `<template><div /></template>\n`;
    const blocks = getSfcBlocks(sfc, "Foo.vue");
    expect(blocks).toEqual({});
  });
});

describe("updateSfcBlock", () => {
  it('replaces <script> content while preserving lang="ts"', () => {
    const sfc = `<template><div /></template>\n<script lang="ts">\nconst a = 1\n</script>\n`;
    const out = updateSfcBlock(sfc, "Foo.vue", "script", "\nconst a = 99\n");
    expect(out).toContain('<script lang="ts">');
    expect(out).toContain("const a = 99");
    expect(out).not.toContain("const a = 1");
  });

  it('preserves <script setup lang="ts"> setup attr', () => {
    const sfc = `<script setup lang="ts">\nconst a = 1\n</script>\n`;
    const out = updateSfcBlock(sfc, "Foo.vue", "script", "\nconst a = 99\n");
    expect(out).toContain('<script setup lang="ts">');
    expect(out).toContain("const a = 99");
  });

  it("preserves <style scoped> scoped attr", () => {
    const sfc = `<style scoped>\n.x { color: red }\n</style>\n`;
    const out = updateSfcBlock(
      sfc,
      "Foo.vue",
      "style",
      "\n.x { color: blue }\n",
    );
    expect(out).toContain("<style scoped>");
    expect(out).toContain("color: blue");
    expect(out).not.toContain("color: red");
  });

  it("returns source unchanged when kind does not exist", () => {
    const sfc = `<template><div /></template>\n`;
    const out = updateSfcBlock(sfc, "Foo.vue", "style", "body {}");
    expect(out).toBe(sfc);
  });

  it("round-trip: get then update then get returns the new content", () => {
    const sfc = `<template><div /></template>\n<script lang="ts">\nconst a = 1\n</script>\n<style scoped>\n.x { color: red }\n</style>\n`;
    const beforeScript = getSfcBlocks(sfc, "Foo.vue").script!.content;
    expect(beforeScript).toBe("\nconst a = 1\n");
    const updated = updateSfcBlock(
      sfc,
      "Foo.vue",
      "script",
      "\nconst a = 42\n",
    );
    const after = getSfcBlocks(updated, "Foo.vue");
    expect(after.script!.content).toBe("\nconst a = 42\n");
    // style 不动
    expect(after.style!.content).toBe("\n.x { color: red }\n");
    expect(updated).toContain("<style scoped>");
  });
});
