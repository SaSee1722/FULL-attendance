/**
 * Cloudinary Service for Image Uploads
 * Reference: https://cloudinary.com/documentation/image_upload_api_reference
 */

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'your_cloud_name';
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'your_unsigned_preset';

export const cloudinaryService = {
  /**
   * Uploads an image from a local URI to Cloudinary.
   * Returns the secure URL of the uploaded image.
   */
  uploadImage: async (localUri: string): Promise<string> => {
    try {
      if (CLOUD_NAME === 'your_cloud_name' || UPLOAD_PRESET === 'your_unsigned_preset') {
        console.warn('Cloudinary credentials are not configured in .env. Skipping upload.');
        return localUri; // Return local URI as fallback for dev
      }

      const formData = new FormData();
      
      // On mobile, we need to handle the file URI specifically
      const filename = localUri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename || '');
      const type = match ? `image/${match[1]}` : `image`;

      // @ts-ignore - React Native FormData requires a specific object structure for files
      formData.append('file', {
        uri: localUri,
        name: filename || 'upload.jpg',
        type
      });
      
      formData.append('upload_preset', UPLOAD_PRESET);
      formData.append('folder', 'profile_images');

      const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Cloudinary Upload Error Details:', errorData);
        throw new Error(errorData.error?.message || 'Failed to upload image to Cloudinary');
      }

      const result = await response.json();
      console.log('Successfully uploaded image to Cloudinary:', result.secure_url);
      return result.secure_url;
    } catch (error) {
      console.error('Error during Cloudinary upload:', error);
      throw error;
    }
  }
};
