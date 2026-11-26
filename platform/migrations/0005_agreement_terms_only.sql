-- Renter and rental details now print as tables, so the agreement text only needs the terms.
UPDATE agreement_versions
SET body = 'This agreement is between Migga Scooter Rental, Sigiriya, Sri Lanka ("Owner") and the renter named above ("Renter"), booking {ref}.' || char(10) || char(10) || substr(body, instr(body, '## Rules and terms'))
WHERE active = 1 AND instr(body, '## Rental details') > 0 AND instr(body, '## Rules and terms') > instr(body, '## Rental details');
