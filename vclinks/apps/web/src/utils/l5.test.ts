import { describe, expect, it } from 'vitest';
import { callText, coordsText, mapUrl } from './l5';

describe('L5 helpers', () => {
  it('mapUrl: own https link wins; coordinates give an OpenStreetMap link; http and nothing give null', () => {
    expect(mapUrl({ url: 'https://maps.example.test/?q=1,2' })).toBe('https://maps.example.test/?q=1,2');
    expect(mapUrl({ lat: 21.0285, lng: 105.8542 })).toBe('https://www.openstreetmap.org/?mlat=21.0285&mlon=105.8542#map=17/21.0285/105.8542');
    expect(mapUrl({ url: 'http://insecure.example.test' })).toBeNull();
    expect(mapUrl({ title: 'Chỉ có tên' })).toBeNull();
    expect(mapUrl({ lat: 999, lng: 0 })).toBeNull();
  });
  it('coordsText', () => {
    expect(coordsText({ lat: 21.0285, lng: 105.8542 })).toBe('21.02850, 105.85420');
    expect(coordsText({ title: 'x' })).toBeNull();
  });
  it('callText covers every outcome', () => {
    expect(callText({ outcome: 'missed' })).toBe('Cuộc gọi nhỡ');
    expect(callText({ outcome: 'declined', video: true })).toBe('Cuộc gọi video bị từ chối');
    expect(callText({ outcome: 'ended', durationSec: 135 })).toBe('Cuộc gọi đã kết thúc · 2:15');
    expect(callText({ outcome: 'unknown' })).toBe('Cuộc gọi');
  });
});
