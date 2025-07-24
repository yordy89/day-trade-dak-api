export const featuresConfig = {
  meetings: {
    // Set to true to use Zoom instead of VideoSDK
    useZoom: process.env.USE_ZOOM_MEETINGS === 'true' || false,
    // Set to false to disable meetings entirely
    enabled: process.env.MEETINGS_ENABLED !== 'false', // Default to true
  },
};

export type FeaturesConfig = typeof featuresConfig;