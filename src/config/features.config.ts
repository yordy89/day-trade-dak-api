export const getFeaturesConfig = () => ({
  meetings: {
    // Set to true to use Zoom instead of VideoSDK
    useZoom: process.env.USE_ZOOM_MEETINGS === 'true',
    // Set to false to disable meetings entirely
    enabled: process.env.MEETINGS_ENABLED !== 'false', // Default to true
  },
});

export const featuresConfig = getFeaturesConfig();

export type FeaturesConfig = ReturnType<typeof getFeaturesConfig>;
