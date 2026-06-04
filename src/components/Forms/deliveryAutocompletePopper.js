/** Keep suggestion lists in a fixed portal so Dialog layout does not jump. */
export function deliveryAutocompletePopperSlot(zIndex = 16000) {
  return {
    popper: {
      disablePortal: false,
      strategy: 'fixed',
      placement: 'bottom-start',
      sx: { zIndex },
      modifiers: [
        { name: 'flip', enabled: false },
        { name: 'preventOverflow', enabled: true, options: { altAxis: true, padding: 8 } },
      ],
    },
    paper: { sx: { maxHeight: 280 } },
    listbox: { sx: { maxHeight: 280 } },
  };
}
