import { Module } from '@nestjs/common';

import { AdoptionsModule } from '../modules/adoptions/adoptions.module';
import { AnimalsModule } from '../modules/animals/animals.module';
import { IamModule } from '../modules/iam/iam.module';
import { ConfigurationModule } from '../platform/configuration/configuration.module';
import { DatabaseModule } from '../platform/database/database.module';

/** Root module. Business modules under src/modules are imported here as they are implemented. */
@Module({
  imports: [ConfigurationModule, DatabaseModule, IamModule, AnimalsModule, AdoptionsModule],
})
export class AppModule {}
