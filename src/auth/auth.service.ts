import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(
      dto.email.toLowerCase(),
    );

    if (existingUser) {
      throw new BadRequestException('Ya existe un usuario con ese email');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email.toLowerCase(),
        password: hashedPassword,
        phone: dto.phone,
        role: dto.role ?? 'CLIENT',
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
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
    const user = await this.usersService.findByEmail(dto.email.toLowerCase());

    if (!user) {
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
      createdAt: user.createdAt,
    };

    const accessToken = await this.generateToken(safeUser);

    return {
      message: 'Login correcto',
      user: safeUser,
      accessToken,
    };
  }

  private async generateToken(user: {
    id: string;
    email: string;
    role: string;
    fullName: string;
  }) {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    });
  }
}