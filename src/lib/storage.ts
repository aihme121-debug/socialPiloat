import { supabase } from '@/lib/supabase'

export async function uploadToStorage(file: File, path: string): Promise<string> {
  try {
    const fileName = `${Date.now()}-${file.name}`
    const fullPath = `${path}/${fileName}`
    
    const { data, error } = await supabase.storage
      .from('social-media-content')
      .upload(fullPath, file)

    if (error) {
      throw error
    }

    const { data: { publicUrl } } = supabase.storage
      .from('social-media-content')
      .getPublicUrl(data.path)

    return publicUrl
  } catch (error) {
    console.error('Storage upload error:', error)
    throw new Error('Failed to upload file')
  }
}

export async function deleteFromStorage(url: string): Promise<void> {
  try {
    const path = url.split('/').pop()
    if (!path) return

    const { error } = await supabase.storage
      .from('social-media-content')
      .remove([path])

    if (error) {
      throw error
    }
  } catch (error) {
    console.error('Storage delete error:', error)
  }
}