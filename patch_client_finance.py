import os

with open('src/screens/Clients.tsx', 'r') as f:
    content = f.read()

# Replace the revenue tab content with the new enhanced dashboard
new_finance = """              {activeTab === 'revenue' && (() => {
                const totalRevenue = clientData.revenues.reduce((sum, r) => sum + r.amount, 0);
                const totalTrackedSeconds = clientData.time.reduce((sum, t) => sum + t.durationSeconds, 0);
                const totalTrackedHours = totalTrackedSeconds / 3600;
                const effectiveHourly = totalTrackedHours > 0 ? totalRevenue / totalTrackedHours : 0;
                
                return (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-surface-neutral p-4 rounded-2xl flex flex-col justify-center">
                      <div className="text-[13px] font-medium text-tx-muted mb-1">Total Revenue</div>
                      <div className="text-[24px] font-light text-tx-primary">{formatCurrency(totalRevenue, preferences.currency)}</div>
                    </div>
                    <div className="bg-surface-neutral p-4 rounded-2xl flex flex-col justify-center">
                      <div className="text-[13px] font-medium text-tx-muted mb-1">Tracked Hours</div>
                      <div className="text-[24px] font-light text-tx-primary">{totalTrackedHours.toFixed(1)}h</div>
                    </div>
                    <div className="bg-surface-neutral p-4 rounded-2xl flex flex-col justify-center">
                      <div className="text-[13px] font-medium text-tx-muted mb-1">Effective Hourly</div>
                      <div className="text-[24px] font-light text-tx-primary">{formatCurrency(effectiveHourly, preferences.currency)}/h</div>
                    </div>
                    <div className="bg-surface-neutral p-4 rounded-2xl flex flex-col justify-center">
                      <div className="text-[13px] font-medium text-tx-muted mb-1">Profit Estimate</div>
                      <div className="text-[24px] font-light text-tx-primary">{formatCurrency(totalRevenue, preferences.currency)}</div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[15px] font-semibold text-tx-primary">Revenue Entries</h3>
                    </div>
                    {clientData.revenues.length === 0 ? (
                      <div className="text-center py-8 text-tx-muted border border-dashed border-bd-subtle rounded-xl">No revenue logged.</div>
                    ) : (
                      clientData.revenues.map(r => (
                        <div key={r.id} className="bg-canvas border border-bd-subtle rounded-xl p-4 flex justify-between items-center">
                          <div>
                            <div className="text-[15px] font-bold text-tx-primary mb-1">{formatCurrency(r.amount, preferences.currency)}</div>
                            <div className="text-[13px] text-tx-muted">{new Date(r.date + 'T00:00:00').toLocaleDateString()} {r.notes && `• ${r.notes}`}</div>
                          </div>
                          <div className={`px-2.5 py-1 rounded-full text-[11px] font-medium uppercase ${r.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-600' : r.status === 'Pending' ? 'bg-yellow-500/10 text-yellow-600' : 'bg-red-500/10 text-red-500'}`}>
                            {r.status}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )})()}"""

start_idx = content.find("              {activeTab === 'revenue' && (")
end_idx = content.find("              {activeTab === 'library' && (")
if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + new_finance + "\n" + content[end_idx:]

with open('src/screens/Clients.tsx', 'w') as f:
    f.write(content)
