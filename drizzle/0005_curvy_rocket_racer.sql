ALTER TABLE "locacoes" ADD COLUMN "numero_os" integer NOT NULL GENERATED ALWAYS AS IDENTITY (sequence name "locacoes_numero_os_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1);--> statement-breakpoint
ALTER TABLE "locacoes" ADD COLUMN "observacoes" text;--> statement-breakpoint
ALTER TABLE "locacoes" ADD CONSTRAINT "locacoes_numero_os_unique" UNIQUE("numero_os");