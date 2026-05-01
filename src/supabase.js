import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Upload PDF to Supabase Storage
export async function uploadPolicy(file, moduleName) {
  const user = supabase.auth.getUser()
  const fileName = `${Date.now()}_${file.name}`

  const { data: storageData, error: storageError } = await supabase.storage
    .from('policies')
    .upload(fileName, file)

  if (storageError) throw storageError

  const { data: urlData } = supabase.storage
    .from('policies')
    .getPublicUrl(fileName)

  const { error: dbError } = await supabase
    .from('policies')
    .insert({
      file_name: file.name,
      file_url: urlData.publicUrl,
      module_name: moduleName,
      uploaded_by: (await supabase.auth.getUser()).data.user?.email,
      is_active: true
    })

  if (dbError) throw dbError

  return urlData.publicUrl
}

export async function extractPDFText(file) {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.7.284/build/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  let fullText = ''

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items.map(item => item.str).join(' ')
    fullText += pageText + '\n'
  }

  return fullText
}