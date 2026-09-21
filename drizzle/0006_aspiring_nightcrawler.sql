CREATE TYPE "public"."destino_entulho" AS ENUM('deposito', 'venda');--> statement-breakpoint
CREATE TYPE "public"."etapa_campo" AS ENUM('entrega', 'retirada', 'baixa');--> statement-breakpoint
CREATE TABLE "registros_campo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"locacao_id" uuid NOT NULL,
	"etapa" "etapa_campo" NOT NULL,
	"foto_pathname" text NOT NULL,
	"registrado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"registrado_por_id" uuid,
	CONSTRAINT "registros_campo_etapa_unica" UNIQUE("locacao_id","etapa")
);
--> statement-breakpoint
ALTER TABLE "locacoes" ADD COLUMN "motorista_id" uuid;--> statement-breakpoint
ALTER TABLE "locacoes" ADD COLUMN "destino_entulho" "destino_entulho";--> statement-breakpoint
ALTER TABLE "registros_campo" ADD CONSTRAINT "registros_campo_locacao_id_locacoes_id_fk" FOREIGN KEY ("locacao_id") REFERENCES "public"."locacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registros_campo" ADD CONSTRAINT "registros_campo_registrado_por_id_usuarios_id_fk" FOREIGN KEY ("registrado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locacoes" ADD CONSTRAINT "locacoes_motorista_id_usuarios_id_fk" FOREIGN KEY ("motorista_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;