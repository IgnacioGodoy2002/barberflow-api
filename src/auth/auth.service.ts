import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export const DEMO_EMAIL = 'demo@barberflow.app';

type TokenUser = {
  id: string;
  email: string;
  role: string;
  fullName: string;
  isDemo?: boolean;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.usersService.findByEmail(email);

    if (existingUser) {
      throw new BadRequestException('Ya existe un usuario con ese email');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName.trim(),
        email,
        password: hashedPassword,
        phone: dto.phone?.trim() || null,
        role: 'CLIENT',
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        isDemo: true,
        createdAt: true,
      },
    });

    const accessToken = await this.generateToken(user);

    return {
      message: 'Usuario registrado correctamente',
      user,
      accessToken,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(
      dto.email.trim().toLowerCase(),
    );

    if (!user || user.isDemo) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);

    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Usuario inactivo');
    }

    const safeUser = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      isDemo: user.isDemo,
      createdAt: user.createdAt,
    };

    const accessToken = await this.generateToken(safeUser);

    return {
      message: 'Login correcto',
      user: safeUser,
      accessToken,
    };
  }

  isDemoEnabled() {
    return this.config.get<string>('DEMO_MODE') === 'true';
  }

  /**
   * Entrada al panel en "modo demo" para quien llega desde el portfolio.
   * Devuelve un token de ADMIN marcado como demo: solo puede leer, y los
   * datos personales de los clientes llegan ocultos (ver DemoInterceptor).
   */
  async loginDemo() {
    if (!this.isDemoEnabled()) {
      throw new NotFoundException('El modo demo no está habilitado');
    }

    const user = await this.prisma.user.upsert({
      where: { email: DEMO_EMAIL },
      update: { role: 'ADMIN', isDemo: true, isActive: true },
      create: {
        email: DEMO_EMAIL,
        fullName: 'Visitante (demo)',
        // Nadie conoce esta contraseña: solo se entra por /auth/demo.
        password: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
        role: 'ADMIN',
        isDemo: true,
      },
    });

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
        isDemo: true,
      },
      { expiresIn: '2h' },
    );

    return {
      message: 'Modo demo: solo lectura',
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isDemo: true,
      },
      accessToken,
    };
  }

  private async generateToken(user: TokenUser) {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      isDemo: Boolean(user.isDemo),
    });
  }
}
