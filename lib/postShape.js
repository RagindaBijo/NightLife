// Posts are shown in their own shape (width ÷ height), kept between portrait 4:5
// and landscape 1.91:1. Taller or wider photos are trimmed to that limit.
// Keep in sync with POST_RATIO_MIN / POST_RATIO_MAX in api/src/shared.js.
export const POST_RATIO_MIN = 4 / 5;
export const POST_RATIO_MAX = 1.91;

/** The shape a post is shown in. Posts without a saved shape show as 4:5. */
export function postRatio(ratio) {
  const value = Number(ratio);
  if (!Number.isFinite(value) || value <= 0) return POST_RATIO_MIN;
  return Math.min(POST_RATIO_MAX, Math.max(POST_RATIO_MIN, value));
}

/** Shape of a picked photo (an ImagePicker asset), within the limits. */
export const assetRatio = (asset) => postRatio(asset?.width && asset?.height ? asset.width / asset.height : null);
