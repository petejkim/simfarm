import { expect, test } from 'bun:test';
import { MAX_ZOOM, MIN_ZOOM, pinchView, settledZoom } from '../src/ui/pinch-zoom';

test('a finished pinch keeps its zoom to whole percent within the range', () => {
  expect(settledZoom(1.4)).toBe(1.4);
  expect(settledZoom(1.23456)).toBe(1.23);
  expect(settledZoom(0.1)).toBe(MIN_ZOOM);
  expect(settledZoom(9)).toBe(MAX_ZOOM);
});
test('pinch view keeps the anchored content point under the fingers', () => {
  // Content point 400,300 (at zoom 1) under viewport point 100,50; doubling the finger distance doubles the zoom.
  expect(pinchView({ zoom: 1, contentX: 400, contentY: 300 }, 2, { x: 100, y: 50 })).toEqual({ zoom: 2, scrollLeft: 700, scrollTop: 550 });
  expect(pinchView({ zoom: 1, contentX: 400, contentY: 300 }, 100, { x: 0, y: 0 }).zoom).toBe(MAX_ZOOM);
});
