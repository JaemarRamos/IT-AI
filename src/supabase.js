import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function uploadPolicy(file, moduleName, policyText, moduleDesc = '') {
  const { data: existing } = await supabase
    .from('policies')
    .select('id, file_url')
    .eq('file_name', file.name)
    .maybeSingle()

  if (existing) {
    const { error: updateError } = await supabase
      .from('policies')
      .update({
        module_name: moduleName,
        policy_text: policyText,
        module_description: moduleDesc,
        is_active: true
      })
      .eq('id', existing.id)

    if (updateError) throw updateError
    return existing.file_url
  }

  const fileName = `${Date.now()}_${file.name}`

  const { error: storageError } = await supabase.storage
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
      policy_text: policyText,
      module_description: moduleDesc,
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

export async function createEmployee(employeeId, password, fullName, email, role = 'employee') {
  const fakeEmail = `${employeeId}@itms.internal`

  const { data, error: authError } = await supabase.auth.signUp({
    email: fakeEmail,
    password: password,
  })

  if (authError) throw authError
  if (!data.user) throw new Error("Failed to create user")

  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: data.user.id,
      employee_id: employeeId,
      full_name: fullName,
      email: email,
      role: role
    })

  if (profileError) throw profileError

  return data.user
}

export async function saveQuizResult(email, employeeId, moduleName, score, totalQuestions, passed) {
  const { data: { user } } = await supabase.auth.getUser()
  
  const { error } = await supabase
    .from('quiz_results')
    .insert({
      user_id: user?.id,
      employee_id: employeeId,
      full_name: email,
      module_name: moduleName,
      score: score,
      passed: passed
    })

  if (error) throw error
}

export async function getPassedModules() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('quiz_results')
    .select('module_name')
    .eq('user_id', user.id)
    .eq('passed', true)

  if (error) return []
  return data.map(r => r.module_name)
}

export async function logout() {
  await supabase.auth.signOut()
  sessionStorage.removeItem("loggedIn")
  sessionStorage.removeItem("employeeId")
  sessionStorage.removeItem("user")
  window.location.href = "/login.html"
}

export async function getAllQuizResults() {
  const { data, error } = await supabase
    .from('quiz_results')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getAllProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}

export async function getAllPolicies() {
  const { data, error } = await supabase
    .from('policies')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data
}