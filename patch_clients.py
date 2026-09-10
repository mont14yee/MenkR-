import re

with open('src/screens/Clients.tsx', 'r') as f:
    content = f.read()

content = content.replace("import { Search, Plus, MoreVertical, Edit2, Trash2, X, ChevronLeft, Phone, Mail, MapPin, Building, Briefcase, DollarSign, Calendar, MessageSquare, Pin } from 'lucide-react';", "import { Search, Plus, MoreVertical, Edit2, Trash2, X, ChevronLeft, Phone, Mail, MapPin, Building, Briefcase, DollarSign, Calendar, MessageSquare, Pin, FolderHeart } from 'lucide-react';")

# Add navigation hook
nav_hook = """  const { push } = useNavigation();
  const { clients, addClient, updateClient, deleteClient, messages, addMessage, deleteMessage } = useClients();"""
content = content.replace("  const { clients, addClient, updateClient, deleteClient, messages, addMessage, deleteMessage } = useClients();", nav_hook)

# Find the Linked Projects card and Total Billed card
old_projects_card = """            <div className="bg-canvas border border-bd-subtle rounded-2xl p-4 flex flex-col">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mb-3">
                <Briefcase size={18} />
              </div>
              <span className="text-[13px] text-tx-muted font-medium mb-1">Linked Projects</span>
              <span className="text-xl font-bold text-tx-primary">
                {projects.filter(p => p.clientId === selectedClient.id).length}
              </span>
            </div>"""

new_projects_card = """            <button onClick={() => push('projects', { filterClientId: selectedClient.id })} className="bg-canvas border border-bd-subtle hover:border-accent-primary/50 rounded-2xl p-4 flex flex-col text-left transition-colors">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mb-3">
                <Briefcase size={18} />
              </div>
              <span className="text-[13px] text-tx-muted font-medium mb-1">Linked Projects</span>
              <span className="text-xl font-bold text-tx-primary">
                {projects.filter(p => p.clientId === selectedClient.id).length}
              </span>
            </button>"""
content = content.replace(old_projects_card, new_projects_card)

old_finance_card = """            <div className="bg-canvas border border-bd-subtle rounded-2xl p-4 flex flex-col">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-3">
                <DollarSign size={18} />
              </div>
              <span className="text-[13px] text-tx-muted font-medium mb-1">Total Billed</span>
              <span className="text-xl font-bold text-tx-primary">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: preferences?.currency || 'USD', maximumFractionDigits: 0 }).format(
                  revenueHistory.filter(r => r.clientId === selectedClient.id).reduce((sum, r) => sum + r.amount, 0)
                )}
              </span>
            </div>"""

new_finance_card = """            <button onClick={() => push('finance', { filterClientId: selectedClient.id })} className="bg-canvas border border-bd-subtle hover:border-accent-primary/50 rounded-2xl p-4 flex flex-col text-left transition-colors">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-3">
                <DollarSign size={18} />
              </div>
              <span className="text-[13px] text-tx-muted font-medium mb-1">Total Billed</span>
              <span className="text-xl font-bold text-tx-primary">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: preferences?.currency || 'USD', maximumFractionDigits: 0 }).format(
                  revenueHistory.filter(r => r.clientId === selectedClient.id).reduce((sum, r) => sum + r.amount, 0)
                )}
              </span>
            </button>"""
content = content.replace(old_finance_card, new_finance_card)

# Add Library link
library_card = """            <button onClick={() => push('library', { filterClientId: selectedClient.id })} className="bg-canvas border border-bd-subtle hover:border-accent-primary/50 rounded-2xl p-4 flex flex-col text-left transition-colors col-span-2">
              <div className="w-8 h-8 rounded-full bg-purple-500/10 text-purple-600 flex items-center justify-center mb-3">
                <FolderHeart size={18} />
              </div>
              <span className="text-[13px] text-tx-muted font-medium mb-1">Library & Files</span>
              <span className="text-[14px] font-medium text-tx-primary">
                View related assets
              </span>
            </button>"""
content = content.replace('          <div className="px-4 py-4 grid grid-cols-2 gap-3">', '          <div className="px-4 py-4 grid grid-cols-2 gap-3">\n' + library_card)


with open('src/screens/Clients.tsx', 'w') as f:
    f.write(content)
