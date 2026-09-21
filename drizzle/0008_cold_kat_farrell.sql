CREATE TABLE "prorrogacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"locacao_id" uuid NOT NULL,
	"dias" integer NOT NULL,
	"valor" integer NOT NULL,
	"registrado_por_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prorrogacoes_dias_positivo" CHECK ("prorrogacoes"."dias" >= 1),
	CONSTRAINT "prorrogacoes_valor_nao_negativo" CHECK ("prorrogacoes"."valor" >= 0)
);
--> statement-breakpoint
ALTER TABLE "locacoes" ADD COLUMN "troca_de_id" uuid;--> statement-breakpoint
ALTER TABLE "registros_campo" ADD COLUMN "capturado_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "prorrogacoes" ADD CONSTRAINT "prorrogacoes_locacao_id_locacoes_id_fk" FOREIGN KEY ("locacao_id") REFERENCES "public"."locacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prorrogacoes" ADD CONSTRAINT "prorrogacoes_registrado_por_id_usuarios_id_fk" FOREIGN KEY ("registrado_por_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locacoes" ADD CONSTRAINT "locacoes_troca_de_id_locacoes_id_fk" FOREIGN KEY ("troca_de_id") REFERENCES "public"."locacoes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "locacoes_troca_unica" ON "locacoes" USING btree ("troca_de_id") WHERE "locacoes"."status" <> 'cancelada';