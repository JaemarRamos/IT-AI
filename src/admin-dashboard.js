export async function showAdminDashboard(TOTAL_QUESTIONS) {
  try {
    const { getAllQuizResults, getAllProfiles, getAllPolicies } = await import('./supabase.js')
    const [results, profiles, policies] = await Promise.all([
      getAllQuizResults(),
      getAllProfiles(),
      getAllPolicies()
    ])

    const readySection = document.getElementById("ready-section")
    readySection.innerHTML = `
      <div class="landing-welcome">
        <div>
          <h2 class="landing-title">Admin Dashboard</h2>
          <p class="landing-sub">Overview of employees, policies and quiz results.</p>
        </div>
        <div class="compliance-badge">
          <span class="compliance-dot"></span>
          <span>${results.length} total attempts</span>
        </div>
      </div>

      <div class="admin-stats">
        <div class="admin-stat-card">
          <div class="admin-stat-number">${profiles.length}</div>
          <div class="admin-stat-label">Employees</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-number">${policies.length}</div>
          <div class="admin-stat-label">Active Policies</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-number">${results.filter(r => r.passed).length}</div>
          <div class="admin-stat-label">Passed</div>
        </div>
        <div class="admin-stat-card">
          <div class="admin-stat-number">${results.filter(r => !r.passed).length}</div>
          <div class="admin-stat-label">Failed</div>
        </div>
      </div>

      <div class="admin-section-label">Employees</div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            ${profiles.length === 0
              ? `<tr><td colspan="5" class="admin-table-empty">No employees yet.</td></tr>`
              : profiles.map(p => `
                <tr>
                  <td>${p.employee_id || '—'}</td>
                  <td>${p.full_name || '—'}</td>
                  <td>${p.email || '—'}</td>
                  <td><span class="status-badge ${p.role === 'admin' ? 'pass' : 'neutral'}">${p.role || 'employee'}</span></td>
                  <td>${new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>

      <div class="admin-section-label">Active Policies</div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Module Name</th>
              <th>File Name</th>
              <th>Uploaded By</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${policies.length === 0
              ? `<tr><td colspan="4" class="admin-table-empty">No policies uploaded yet.</td></tr>`
              : policies.map(p => `
                <tr>
                  <td>${p.module_name || '—'}</td>
                  <td>${p.file_name || '—'}</td>
                  <td>${p.uploaded_by || '—'}</td>
                  <td>${new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>

      <div class="admin-section-label">Quiz Results</div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Full Name</th>
              <th>Module</th>
              <th>Score</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            ${results.length === 0
              ? `<tr><td colspan="6" class="admin-table-empty">No quiz results yet.</td></tr>`
              : results.map(r => `
                <tr>
                  <td>${r.employee_id || '—'}</td>
                  <td>${r.full_name || '—'}</td>
                  <td>${r.module_name || '—'}</td>
                  <td>${r.score}/${TOTAL_QUESTIONS}</td>
                  <td><span class="status-badge ${r.passed ? 'pass' : 'fail'}">${r.passed ? 'Passed' : 'Failed'}</span></td>
                  <td>${new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              `).join('')
            }
          </tbody>
        </table>
      </div>
    `

    document.getElementById("ready-btn")?.classList.add("hidden")
    document.getElementById("input-section")?.classList.add("hidden")

  } catch (err) {
    console.error("Failed to load results:", err)
  }
}