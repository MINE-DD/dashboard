# Seed database (#TODO)

This folder contains a script to seed the database with example models and validations.

## Usage

1. Create a `.env` file in the root directory of this project with the following content:

```
DATABASE_URL=postgres://username:password@localhost:5432/database_name
```

2. Run the following command to seed the database:

```
bun run seed:dev
```

This will seed the database with example models and validations.
