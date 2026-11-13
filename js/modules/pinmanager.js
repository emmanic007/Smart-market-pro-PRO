'use strict';
const PinManager = {
  async change() {
    if (!Auth.currentUser) return UI.toast(I18n.t('toast_err_auth'),'danger');

    const currentVal = document.getElementById('pin-current')?.value;
    const newPin     = document.getElementById('pin-new')?.value;
    const newPin2    = document.getElementById('pin-new2')?.value;

    // Validations
    if (!currentVal || currentVal.length !== 4) return UI.toast(I18n.t('toast_err_pin_enter'),'danger');
    if (!newPin     || newPin.length !== 4)      return UI.toast(I18n.t('toast_err_pin_4digits_new'),'danger');
    if (!/^\d{4}$/.test(newPin))                return UI.toast(I18n.t('toast_err_pin_digits'), 'danger');
    if (newPin !== newPin2)                      return UI.toast(I18n.t('toast_err_pin_mismatch'),'danger');
    if (newPin === currentVal)                   return UI.toast(I18n.t('toast_err_pin_same'),'warning');

    // Verify current PIN
    const currentHash = await Utils.sha256(currentVal);
    const user = DB.data.users.find(u => u.id === Auth.currentUser.id);
    if (!user || user.pinHash !== currentHash) {
      return UI.toast(I18n.t('toast_err_pin_current_wrong'),'danger');
    }

    // Check new PIN not used by another user
    const newHash = await Utils.sha256(newPin);
    const conflict = DB.data.users.find(u => u.pinHash === newHash && u.id !== user.id);
    if (conflict) return UI.toast(I18n.t('toast_err_pin_used_other'),'danger');

    // Update
    user.pinHash = newHash;
    DB.save();

    // Clear fields
    ['pin-current','pin-new','pin-new2'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });

    UI.toast(I18n.t('toast_pin_updated'),'success');
  }
};

/* ═══════════════ USERS ═══════════════ */
