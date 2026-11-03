class Form {
  constructor() { this.buttons = []; this.toggles = []; }
  title() { return this; } body() { return this; } header() { return this; } label() { return this; } divider() { return this; }
  button(t) { this.buttons.push(t); return this; }
  toggle(t, o) { this.toggles.push(o?.defaultValue ?? false); return this; }
  slider() { return this; } dropdown() { return this; } textField() { return this; } submitButton() { return this; }
  async show() { globalThis.__forms = (globalThis.__forms ?? 0) + 1; return { canceled: true, selection: undefined, formValues: this.toggles }; }
}
export class ActionFormData extends Form {}
export class ModalFormData extends Form {}
export class MessageFormData extends Form { button1() { return this; } button2() { return this; } }
