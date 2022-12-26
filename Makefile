migrate:
	- node -e 'require(".").migrate()';

rollback:
	- node -e 'require(".").rollback()';

refresh:
	- node -e 'require(".").refresh()';

fresh:
	- node -e 'require(".").fresh()';

seed:
	- node -e 'require(".").seed()';