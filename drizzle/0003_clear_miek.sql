ALTER TABLE "tipos_cacamba" ALTER COLUMN "contagem_prazo" SET DEFAULT 'corridos';--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "construtora" boolean DEFAULT false NOT NULL;