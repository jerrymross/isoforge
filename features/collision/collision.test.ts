import { describe, expect, it } from "vitest";
import {
  collisionBounds,
  createCollisionShape,
  isValidCollision,
  resizeCollision,
} from "./collision";

describe("collision geometry", () => {
  it.each(["rectangle", "polygon", "ellipse", "diamond"] as const)(
    "creates a valid %s",
    (kind) => {
      expect(isValidCollision(createCollisionShape(kind, kind))).toBe(true);
    },
  );

  it("moves and scales a collision shape through its bounds", () => {
    const shape = createCollisionShape("diamond", "diamond");
    const resized = resizeCollision(shape, { x: 10, y: 20, width: 200, height: 80 });
    expect(collisionBounds(resized)).toEqual({ x: 10, y: 20, width: 200, height: 80 });
  });
});
