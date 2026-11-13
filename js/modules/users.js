'use strict';
const Users = {
  async add() {
    const name = document.getElementById('u-name')?.value.trim();
    const pin  = document.getElementById('u-pin')?.value;
    const pin2 = document.getElementById('u-pin2')?.value;
    const role = document.getElementById('u-role')?.value;
    if (!name)              return UI.toast(I18n.t('toast_err_name_required'),'danger');
    if (name.length>50)     return UI.toast(I18n.t('toast_err_name_too_long'),'danger');
    if (!pin||pin.length!==4) return UI.toast(I18n.t('toast_err_pin_4digits'),'danger');
    if (!/^\d{4}$/.test(pin)) return UI.toast(I18n.t('toast_err_pin_digits'),'danger');
    if (pin!==pin2)         return UI.toast(I18n.t('toast_err_pin_match2'),'danger');
    const pinHash=await Utils.sha256(pin);
    if (DB.data.users.some(u=>u.pinHash===pinHash)) return UI.toast(I18n.t('toast_err_pin_used'),'danger');
    DB.data.users.push({id:Utils.uid(),name,pinHash,role:role||'seller',createdAt:new Date().toISOString()});
    DB.save(); UI.renderUsers();
    UI.toast(`${I18n.t('toast_account_created')} : ${name}`,'success');
    ['u-name','u-pin','u-pin2'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  },

  async remove(id) {
    if (!Auth.isAdmin()) return UI.toast(I18n.t('toast_err_admin_required'),'danger');
    if (id===Auth.currentUser?.id) return UI.toast(I18n.t('toast_err_delete_self'),'danger');
    const t=DB.data.users.find(u=>u.id===id);
    if (DB.data.users.filter(u=>u.role==='admin').length<=1&&t?.role==='admin') return UI.toast(I18n.t('toast_err_last_admin'),'danger');
    if (!await SmpModal.confirm(`${I18n.t('modal_delete_account_title')} "${t?.name}" ?`, {title:I18n.t('modal_delete_account_title'), icon:'👤', okLabel:I18n.t('modal_delete_account_ok'), okClass:'btn-danger'})) return;
    DB.data.users=DB.data.users.filter(u=>u.id!==id);
    DB.save(); UI.renderUsers();
    UI.toast(I18n.t('toast_account_deleted'),'warning');
  },

  openEdit(userId) {
    const u = DB.data.users.find(x => x.id === userId);
    if (!u) return;
    const ov = document.getElementById('smp-edit-user-overlay');
    const ni = document.getElementById('edit-user-id');
    const nn = document.getElementById('edit-user-name');
    const np = document.getElementById('edit-user-pin');
    const er = document.getElementById('edit-user-error');
    if (ni) ni.value = userId;
    if (nn) nn.value = u.name;
    if (np) np.value = '';
    if (er) er.textContent = '';
    if (ov) { ov.style.display = 'flex'; setTimeout(() => nn?.focus(), 100); }
  },

  closeEdit() {
    const ov = document.getElementById('smp-edit-user-overlay');
    if (ov) ov.style.display = 'none';
  },

  async saveEdit() {
    const userId = document.getElementById('edit-user-id')?.value;
    const name   = document.getElementById('edit-user-name')?.value.trim();
    const pin    = document.getElementById('edit-user-pin')?.value;
    const errEl  = document.getElementById('edit-user-error');
    const u      = DB.data.users.find(x => x.id === userId);
    if (!u) { this.closeEdit(); return; }
    if (!name) { if (errEl) errEl.textContent = I18n.t('toast_err_name_required'); return; }
    if (pin && (pin.length !== 4 || !/^[0-9]{4}$/.test(pin))) {
      if (errEl) errEl.textContent = I18n.t('toast_err_pin_4digits'); return;
    }
    u.name = name;
    if (pin) u.pinHash = await Utils.sha256(pin);
    DB.save();
    UI.renderAll();
    Auth.renderAccountsList();
    UI.toast(`${I18n.t('toast_account_updated')} : ${name}`,'success');
    this.closeEdit();
  }
};
