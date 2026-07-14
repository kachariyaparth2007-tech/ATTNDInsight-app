import java.util.Scanner;
public class max {
    public static void main(String[] args) {
       int a,b,c; 
       Scanner sc = new Scanner(System.in);
       
       System.out.print("Enter three numbers: ");
       a = sc.nextInt();
       b = sc.nextInt();
       c = sc.nextInt();
       
       if(a>b && a>c)
           System.out.println("A is max");
       else if(b>a && b>c)
           System.out.println("B is max");
       else
           System.out.println("C is max");
    }
}
