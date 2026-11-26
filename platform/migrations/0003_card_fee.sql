-- Card service fee: the bank takes this % of every card payment, so guests paying by card cover it.
INSERT OR IGNORE INTO settings (key, value) VALUES ('card_fee_pct', '3.5');
UPDATE agreement_versions SET body = replace(body,
  'in LKR, by cash, bank transfer, card or online payment.',
  'in LKR, by cash, bank transfer, card or online payment. Card payments have a service fee of {card_fee_pct}% charged by the bank, which is added to the amount paid by card.')
WHERE instr(body, 'in LKR, by cash, bank transfer, card or online payment.') > 0 AND instr(body, 'card_fee_pct') = 0;
