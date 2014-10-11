/**
 * Users
 */
CREATE TABLE IF NOT EXISTS dansa_users (
	id serial PRIMARY KEY,
	created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

/**
 * Songs
 */
CREATE TABLE IF NOT EXISTS dansa_songs (
	id serial PRIMARY KEY,
	created TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
	user_id integer,
	notes text,
	bpm decimal,
	posOffset decimal,
	scId integer,
	FOREIGN KEY (user_id)
		REFERENCES dansa_users(id)
		ON DELETE SET NULL
		ON UPDATE CASCADE
);
