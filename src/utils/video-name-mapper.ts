/**
 * Video name mapping utility for DayTradeDak
 * Maps S3 file paths to clean display names
 */

export class VideoNameMapper {
  /**
   * Simplified mapping without day numbers for clean ordering
   */
  private static readonly CURSO1_MAPPINGS: Record<string, string> = {
    '1_Introduccion': 'Introducción',
    '2_Leccion_1_teoria': 'Lección 1 - Teoría',
    '3_Leccion_1_practico': 'Lección 1 - Práctico',
    '4_Leccion_2_teoria': 'Lección 2 - Teoría',
    '5_Leccion_2_practica': 'Lección 2 - Práctico',
    '6_Leccion_3_teoria': 'Lección 3 - Teoría',
    '7_Leccion_3_practica': 'Lección 3 - Práctico',
    '8_Leccion_4_teoria': 'Lección 4 - Teoría',
    '9_Leccion_4_practica': 'Lección 4 - Práctico',
    '10_Leccion_5_teoria': 'Lección 5 - Teoría',
    '11_leccion_5_practica': 'Lección 5 - Práctico',
    '12_Leccion_6_teoria': 'Lección 6 - Teoría',
    '13_Leccion_6 practica': 'Lección 6 - Práctico',
    '14_Leccion_7_teoria': 'Lección 7 - Teoría',
    '15_Leccion_7_practica': 'Lección 7 - Práctico',
    '16_Leccion_8_teoria': 'Lección 8 - Teoría',
    '17_Leccion_8_practica': 'Lección 8 - Práctico',
    '18_Leccion_9_teoria': 'Lección 9 - Teoría',
    '19_Leccion_9_practica': 'Lección 9 - Práctico',
    '20_Leccion_10_teoria': 'Lección 10 - Teoría',
    '21_Leccion_10_practica': 'Lección 10 - Práctico',
    '22_Leccion_11_teoria': 'Lección 11 - Teoría',
    '23_Leccion_11_practica': 'Lección 11 - Práctico',
    '24_Leccion_12_teoria': 'Lección 12 - Teoría',
    '25_Leccion_12_practica': 'Lección 12 - Práctico',
    '26_Leccion_13_teoria': 'Lección 13 - Teoría',
    '27_Leccion_13_practica': 'Lección 13 - Práctico',
    '28_Leccion_14_teoria': 'Lección 14 - Teoría',
    '29_Leccion_14_practica': 'Lección 14 - Práctico',
    '30_Leccion_15_teoria': 'Lección 15 - Teoría',
    '31_Leccion_15_practica': 'Lección 15 - Práctico',
    '32_Leccion_16_teoria': 'Lección 16 - Teoría',
    '33_Leccion_16_practica': 'Lección 16 - Práctico',
    '34_Leccion_17_teoria': 'Lección 17 - Teoría',
    '35_Leccion_17_practica': 'Lección 17 - Práctico',
    '36_Leccion_18_teoria': 'Lección 18 - Teoría',
    '37_Leccion_18_practica': 'Lección 18 - Práctico',
    '38_Leccion_19_teoria': 'Lección 19 - Teoría',
    '39_Leccion_19_practica': 'Lección 19 - Práctico',
    '40_Leccion_20_teoria': 'Lección 20 - Teoría',
    '41_Leccion_20_practica': 'Lección 20 - Práctico',
    '42_Leccion_21_teoria': 'Lección 21 - Teoría',
    '43_Leccion_21_practica': 'Lección 21 - Práctico'
  };

  /**
   * Extract folder name from S3 key
   */
  private static extractFolderName(key: string): string {
    // Key format: "hsl-daytradedak-videos/psicotrading-curso1/FOLDER_NAME/file.m3u8"
    const parts = key.split('/');
    return parts.length >= 3 ? parts[2] : '';
  }

  /**
   * Extract lesson number from folder name for sorting
   */
  private static extractLessonOrder(folderName: string): number {
    const match = folderName.match(/^(\d+)_/);
    return match ? parseInt(match[1], 10) : 999;
  }

  /**
   * Map S3 key to display name for Curso 1 (Paz con El Dinero)
   */
  public static mapCurso1VideoName(key: string): string {
    const folderName = this.extractFolderName(key);
    return this.CURSO1_MAPPINGS[folderName] || folderName;
  }

  /**
   * Process and enrich video metadata with display names
   */
  public static processCurso1Videos(videos: any[]): any[] {
    // Group videos by folder to avoid duplicate entries
    const videoGroups = new Map<string, any>();
    
    videos.forEach(video => {
      const folderName = this.extractFolderName(video.key);
      
      if (!videoGroups.has(folderName)) {
        videoGroups.set(folderName, {
          ...video,
          folderName,
          displayName: this.mapCurso1VideoName(video.key),
          lessonOrder: this.extractLessonOrder(folderName),
          videos: []
        });
      }
      
      // Add this specific video file to the group
      videoGroups.get(folderName)!.videos.push({
        key: video.key,
        quality: this.extractQuality(video.key),
        signedUrl: video.signedUrl,
        size: video.size,
        lastModified: video.lastModified
      });
    });
    
    // Convert to array and sort by lesson order
    const sortedGroups = Array.from(videoGroups.values())
      .sort((a, b) => a.lessonOrder - b.lessonOrder);
    
    // Return flat array with display names
    return sortedGroups.map(group => ({
      key: group.key,
      signedUrl: group.signedUrl,
      size: group.size,
      lastModified: group.lastModified,
      displayName: group.displayName,
      lessonOrder: group.lessonOrder,
      folderName: group.folderName
    }));
  }

  /**
   * Extract video quality from key
   */
  private static extractQuality(key: string): string {
    if (key.includes('master.m3u8')) return 'master';
    if (key.includes('720p')) return '720p';
    if (key.includes('480p')) return '480p';
    if (key.includes('360p')) return '360p';
    return 'unknown';
  }
}